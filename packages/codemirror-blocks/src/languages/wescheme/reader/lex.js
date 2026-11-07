/* eslint-disable */
// Vendored from wescheme-js 0.0.4 (github.com/bootstrapworld/wescheme-js),
// which is LGPL 2.1 (see ./LICENSE), and maintained here: the editor's reader.
var compiler = require('./structures');
var types = require('./types');
var jsnums = require('./js-numbers');

/*

 Follows WeScheme's current implementation of Advanced Student
 http://docs.racket-lang.org/htdp-langs/advanced.html

 NOT SUPPORTED BY MOBY, WESCHEME, OR THIS COMPILER: define-datatype, begin0, set!, time, delay, shared, recur,
    match, check-member-of, check-range, (require planet), byetstrings (#"Apple"),
    regexps (#rx or #px), hashtables (#hash), graphs (#1=100 #1# #1#), #reader and #lang
 */

//////////////////////////////////////////////////////////////////////////////
////////////////////////////////// LEXER OBJECT //////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// Parse a program into SExps
//
// A SExp is either:
// - Literal x Location
// - symbolExpr x Location
// - [ListOf SExp] x Location
//
// A Literal is either:
// - types.<number>
// - types.string
// - types.char
// - types.vector

/////////////////////
/*      Data       */
/////////////////////

// import frequently-used bindings
var literal = compiler.literal;
var comment = compiler.comment;
var symbolExpr = compiler.symbolExpr;
var unsupportedExpr = compiler.unsupportedExpr;
var throwError = compiler.throwError;

// a collection of common RegExps
var leftListDelims = /[(\u005B\u007B]/
  , rightListDelims = /[)\u005D\u007D]/
  , matchUntilDelim = /^[^(\u005B\u007B)\u005D\u007D\s]+/
  , quotes = /[\'`,]/
  , hex2 = new RegExp("^([0-9a-f]{1,2})", "i")
  , hex4 = new RegExp("^([0-9a-f]{1,4})", "i")
  , hex6 = new RegExp("^([0-9a-f]{1,6})", "i")
  , hex8 = new RegExp("^([0-9a-f]{1,8})", "i")
  , oct3 = new RegExp("^([0-7]{1,3})", "i");

// the delimiters encountered so far, line and column, and case-sensitivity
var delims, line, column, startCol, startRow, source, caseSensitiveSymbols;
// last-seen comments and sexps, so we can associate one with the other
var lastComment = false, lastSexp = false;
// UGLY HACK to track index if an error occurs. We should remove this if we can make it entirely stateless
var endOfError;

// the location struct
// endCol and endRow are included for pyret error location
class Location {
  constructor(startCol, startRow, startChar, span, theSource) {
    this.startCol = startCol; // starting index into the line
    this.startRow = startRow; // starting line # (1-index)
    this.startChar = startChar; // ch index of lexeme start, from beginning
    this.span = span; // num chrs between lexeme start and end
    this.source = theSource || source; // [OPTIONAL] id of the containing DOM element

    this.endCol = column; // ending index into the line
    this.endRow = line; // ending index into the line
    this.endChar = startChar + span; // ch index of lexeme end, from beginning
  }
  start() { return new Location("", "", this.startChar, 1); };
  end()   { return new Location("", "", this.startChar + this.span - 1, 1); };
  toVector() {
    return new types.vector(['"' + this.source + '"' // add quotes to the source, since it's a str (not a symbol)
                            , this.startChar + 1, this.startRow, this.startCol, this.span]);
  };
  toString() {
    return {
      line: this.startRow.toString()
      , id: this.source
      , span: this.span.toString()
      , offset: (this.startChar + 1).toString()
      , column: this.startCol.toString()
    };
  };
};

/////////////////////
/* Utility Methods */
/////////////////////

// some important string methods
function isWhiteSpace(str) {
  return (/\s/).test(str);
}

// determines if a character string is in one of the three sets of delimiters
function isDelim(x) {
  return x === '(' || x === ')' || x === '[' || x === ']' || x === '{' || x === '}';
}

// determines if they are matching delimiter pairs
// ie ( and ) [ and ] { and }
function matchingDelims(x, y) {
  return (x === '(' && y === ')') || (x === '[' && y === ']') || (x === '{' && y === '}');
}

// gets the matching delim given the other delim in a pair
function otherDelim(x) {
  return x === '(' ? ')' :
    x === '[' ? ']' :
    x === '{' ? '}' :
    x === ')' ? '(' :
    x === ']' ? '[' :
    x === '}' ? '{' :
    /* else */
    throwError(new types.Message(["otherDelim: Unknown delimiter: ", x]));
}

// reads through whitespace
function chewWhiteSpace(str, i) {
  var p;
  if (i < str.length) {
    p = str.charAt(i);
    while (isWhiteSpace(p) && i < str.length) {
      // increment column/line counters
      if (p === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
      p = str.charAt(++i);
    }
  }
  return i;
}

export function sexpToString(sexp) {
  return (sexp instanceof Array) ? "(" + sexp.map(sexpToString).join(" ") + ")" : sexp.toString();
}

// use heuristic to assign comments to an sexp
function maybeAssignComment(sexp) {
  // if it's code and there's an un-assigned comment
  // immediately-preceding line, assign it and clear the comment
  if(!(sexp instanceof comment) && lastComment &&
    lastComment.location.endRow === sexp.location.startRow-1) { 
    sexp.comment = lastComment;
    lastComment = false;
  // if it's a comment and there's an un-commented sexp on
  // the same line, assign it and clear the comment
  } else if((sexp instanceof comment) && lastSexp &&
            (lastSexp.location.endRow == sexp.location.startRow)) {
    lastSexp.comment = sexp;
    lastComment = false;
  // merge unattached comments with the contiguous previous comments
  } else if(sexp instanceof comment) {
      if(lastComment && lastComment.location.endRow == sexp.location.endRow-1) {
      sexp.txt = lastComment.txt + "\n" + sexp.txt;
    } 
    lastComment = sexp;
  }
}


/////////////////////
/* Primary Methods */
/////////////////////

// readProg : String String -> SExp
// reads multiple sexps encoded into this string and converts them to a SExp
// datum
function readProg(str, strSource) {
  // set all state back to beginning
  var i = 0;
  startCol = column = 0, startRow = line = 1; // initialize all position indices
  caseSensitiveSymbols = true;                // initialize case sensitivity
  lastComment = lastSexp = false;             // initialize comment tracking
  source = strSource || "<definitions>";
  var sexp, sexps = [];
  delims = [];
  // get rid of any whitespace at the start of the string
  i = chewWhiteSpace(str, 0);
  while (i < str.length) {
    sexp = readSExpByIndex(str, i);
    if (!(sexp instanceof comment)) {
      sexps.push(sexp);
    }
    i = chewWhiteSpace(str, sexp.location.startChar + sexp.location.span);
  }
  sexps.location = new Location(startCol, startRow, 0, i, source);
  maybeAssignComment(sexp);
  lastSexp = sexp;
  return sexps;
}

// readSExpByIndex : String Number -> SExp
// reads a sexp encoded as a string starting at the i'th character and converts
// it to a SExp datum
function readSExpByIndex(str, i) {
  startCol = column;
  startRow = line;
  var iStart = i;
  i = chewWhiteSpace(str, i);
  var p = str.charAt(i);
  if (i >= str.length) {
    endOfError = i; // remember where we are, so readList can pick up reading
    throwError(new types.Message([source, ":", startRow.toString(), ":", (startCol - 1).toString(), ": read: (found end-of-file)"]), new Location(startCol - 1, startRow, i - 2, 2) // back up the startChar before #;, make the span include only those 2


      
      , "Error-GenericReadError");
  }
  var sexp = rightListDelims.test(p) ?
    throwError(new types.Message(["read: expected a ", otherDelim(p), " to open ", new types.ColoredPart(p, new Location(column, startRow, iStart, 1))]), new Location(column, startRow, iStart, 1)) :
    leftListDelims.test(p) ? readList(str, i) :
    p === '"' ? readString(str, i) :
    p === '#' ? readPoundSExp(str, i) :
    p === ';' ? readLineComment(str, i) :
    quotes.test(p) ? readQuote(str, i) :
    /* else */
    readSymbolOrNumber(str, i);
    
  // see if we can assign a comment to this sexp
  maybeAssignComment(sexp);
  lastSexp = sexp;
  return sexp;
}

// readList : String Number -> SExp
// reads a list encoded in this string with the left delimiter at index i
function readList(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i
    , innerError = false
    , errorLocation = new Location(startCol, startRow, iStart, 1)
    , openingDelim = str.charAt(i++)
    , dot1Idx = false
    , dot2Idx = false // indices of the dot operator
    , msg;
  column++; // move forward to count the closing delimeter
  var list = [];
  // grab lastComment if one exists
  if(lastComment) { list.comment = lastComment; lastComment = null; }
  delims.push(openingDelim);
  i = chewWhiteSpace(str, i);

  // read a single list item
  // To allow optimization in v8, this function is broken out into its own (named) function
  // see http://www.html5rocks.com/en/tutorials/speed/v8/#toc-topic-compilation
  function readListItem(str, i, list) {
    var sexp = readSExpByIndex(str, i); // read the next s-exp
    i = sexp.location.end().startChar + 1; // move i to the character at the end of the sexp
    // if it's a dot, treat it as a cons
    if (sexp instanceof symbolExpr && sexp.val == '.') {
      if (dot2Idx) {
        var msg = new types.Message(["A syntax list may have only 2 `.'s"]);
        throwError(msg, list[dot1Idx].location);
      }
      dot2Idx = dot1Idx ? list.length : false; // if we've seen dot1, save this idx to dot2Idx
      dot1Idx = dot1Idx || list.length; // if we haven't seen dot1, save this idx to dot1Idx
    }
    if (!(sexp instanceof comment)) { // if it's not a comment, add it to the list
      sexp.parent = list; // set this list as it's parent
      list.push(sexp); // and add the sexp to the list
    }
    lastSexp = sexp;
    return i;
  }

  // if we have one dot, splice the element at that idx into the list
  // if we have two dots, move the element they surround to the front
  // throw errors for everything else
  function processDots(list, dot1Idx, dot2Idx) {
    // if the dot is the first element in the list, throw an error
    if (dot1Idx === 0) {
      msg = new types.Message(["A `.' cannot be the first element in a syntax list"]);
      throwError(msg, list[dot1Idx].location);
    }
    // if a dot is the last element in the list, throw an error
    if (dot1Idx === (list.length - 1) || dot2Idx === (list.length - 1)) {
      msg = new types.Message(["A `.' cannot be the last element in a syntax list"]);
      throwError(msg, list[dot2Idx || dot1Idx].location);
    }

    // assuming they are legal, if there are two dots in legal places...
    if (dot2Idx) {
      // if they are not surrounding a single element, throw an error
      if (dot2Idx - dot1Idx !== 2) {
        msg = new types.Message(["Two `.'s may only surround one syntax item"]);
        throwError(msg, list[dot2Idx].location);
        // if they are, move that element to the front of the list and remove the dots
      } else {
        return list.slice(dot1Idx + 1, dot1Idx + 2).concat(list.slice(0, dot1Idx), list.slice(dot2Idx + 1));
      }
    }
    // okay, we know there's just one dot, so the next element had better be a list AND the last element of the outer list
    if (!(list[dot1Idx + 1] instanceof Array)) {
      msg = new types.Message(["A `.' must be followed by a syntax list, but found ", new types.ColoredPart("something else", list[dot1Idx + 1].location)])
      throwError(msg, list[dot1Idx + 1].location);
    }
    if (list.length > dot1Idx + 2) {
      msg = new types.Message(["A `.' followed by a syntax list must be followed by a closing delimeter, but found ", new types.ColoredPart("something else", list[dot1Idx + 2].location)])
      throwError(msg, list[dot1Idx + 1].location);
      // splice that element into the list, removing the dots
    } else {
      return list.slice(0, dot1Idx).concat(list[dot1Idx + 1], list.slice(dot1Idx + 2));
    }
  }

  // if we see an error while reading a listItem
  function handleError(e) {
    // Some errors we throw immediately, without reading the rest of the list...
    if (/expected a .+ to (close|open)/.exec(e) // brace or dot errors
      || /unexpected/.exec(e) // unexpected delimiter
      || /syntax list/.exec(e) // improper use of .
      || /bad syntax/.exec(e) // bad syntax
      || /bad character constant/.exec(e) // bad character constant
    ) {
      throw e;
    } else {
      // when we reconstruct the location from an error, we use Racket-style fieldnames, for historical reasons
      var eLoc = JSON.parse(JSON.parse(e)["structured-error"]).location;
      errorLocation = new Location(Number(eLoc.column), Number(eLoc.line)
        , Number(eLoc.offset) - 1, Number(eLoc.span));
      i = endOfError; // keep reading from the last error location
      innerError = e;
    }
    return i;
  }

  // read forward until we see a closing delim, saving the last known-good location
  while (i < str.length && !rightListDelims.test(str.charAt(i))) {
    // check for newlines
    if (str.charAt(i) === "\n") {
      line++;
      column = 0;
    }
    try {
      i = readListItem(str, i, list);
    } // read a list item, hopefully without error
    catch (e) {
      i = handleError(e);
    } // try to keep reading from endOfError...
    // move reader to the next token
    i = chewWhiteSpace(str, i);
  }
  // if we reached the end of an otherwise-successful list but there's no closing delim...
  if (i >= str.length) {
    msg = new types.Message(["read: expected a ", otherDelim(openingDelim)
      , " to close "
      , new types.ColoredPart(openingDelim.toString()
        , new Location(startCol, startRow, iStart, 1))
    ]);
    // throw an error
    throwError(msg, errorLocation);
  }
  // if we reached the end of an otherwise-successful list and it's the wrong closing delim...
  if (!matchingDelims(openingDelim, str.charAt(i))) {
    msg = new types.Message(["read: expected a ", otherDelim(openingDelim)
      , " to close "
      , new types.ColoredPart(openingDelim.toString()
        , new Location(startCol, startRow, iStart, 1))
      , " but found a "
      , new types.ColoredPart(str.charAt(i).toString()
        , new Location(column, line, i, 1))
    ]);
    throwError(msg, new Location(column, line, i, 1));
  }

  column++;
  i++; // move forward to count the closing delimeter
  // if an error occured within the list, set endOfError to the end, and throw it
  if (innerError) {
    endOfError = i;
    throw innerError;
  }

  // deal with dots, if they exist
  if (dot1Idx || dot2Idx) list = processDots(list, dot1Idx, dot2Idx);
  list.location = new Location(startCol, startRow, iStart, i - iStart);
  return list;
}

// readString : String Number -> SExp
// reads a string encoded in this string with the leftmost quotation mark
// at index i
function readString(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i
    , match;
  // greedily match to the end of the string, before examining escape sequences
  var closedString = /^\"[^\"]*(\\\"[^\"]*)*[^\\]\"|\"\"/.test(str.slice(i))
    , greedy = /^\"[^\"]*(\\"[^\"]*)*/.exec(str.slice(iStart))[0];
  i++;
  column++; // skip over the opening quotation mark char
  // it's a valid string, so let's make sure it's got proper escape sequences
  var chr, datum = "";
  while (i < str.length && str.charAt(i) !== '"') {
    chr = str.charAt(i++);
    // track line/char values while we scan
    if (chr === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
    if (chr === '\\') {
      column++; // move the column forward to skip over the escape character
      chr = str.charAt(i++);
      if (i >= str.length) break; // if there's nothing there, break out
      switch (true) {
        case /a/.test(chr):
          chr = '\u0007';
          break;
        case /b/.test(chr):
          chr = '\b';
          break;
        case /t/.test(chr):
          chr = '\t';
          break;
        case /n/.test(chr):
          chr = '\n';
          break;
        case /v/.test(chr):
          chr = '\v';
          break;
        case /f/.test(chr):
          chr = '\f';
          break;
        case /r/.test(chr):
          chr = '\r';
          break;
        case /e/.test(chr):
          chr = '\u0027';
          break;
        case /\n/.test(chr):
          chr = '';
          break; // newlines disappear
        case /[\"\'\\]/.test(chr):
          break;
          // if it's a charCode symbol, match with a regexp and move i forward
        case /[xuU]/.test(chr):
          var regexp = chr === "x" ? hex2 : chr === "u" ? hex4
            /* else */
            : hex8;
          if (!regexp.test(str.slice(i))) {
            // remember where we are, so readList can pick up reading
            endOfError = iStart + greedy.length + 1;
            throwError(new types.Message([source, ":", startRow.toString(), ":", startCol.toString(), ": read: no hex digit following \\" + chr + " in string"]), new Location(startCol, startRow, iStart, i - iStart + 1), "Error-GenericReadError");
          }
          match = regexp.exec(str.slice(i))[1];
          chr = String.fromCharCode(parseInt(match, 16));
          i += match.length;
          column += match.length;
          break;
        case oct3.test(str.slice(i - 1)):
          match = oct3.exec(str.slice(i - 1))[1];
          chr = String.fromCharCode(parseInt(match, 8));
          i += match.length - 1;
          column += match.length - 1;
          break;
        default:
          // remember where we are, so readList can pick up reading
          endOfError = iStart + greedy.length + 1;
          throwError(new types.Message([source, ":", startRow.toString(), ":", startCol.toString(), ": read: unknown escape sequence \\" + chr + " in string"]), new Location(startCol, startRow, iStart, i - iStart), "Error-GenericReadError");
      }
    }
    datum += chr;
  }

  // if the next char after iStart+openquote+greedy isn't a closing quote, it's an unclosed string
  if (!closedString) {
    endOfError = iStart + greedy.length; // remember where we are, so readList can pick up reading
    throwError(new types.Message([source, ":", startRow.toString(), ":", startCol.toString(), ": read: expected a closing \'\"\'"]), new Location(startCol, startRow, iStart, 1), "Error-GenericReadError");
  }
  var strng = new literal(new types.string(datum));
  i++;
  column++; // move forward to include the ending quote
  strng.location = new Location(startCol, startRow, iStart, i - iStart);
  return strng;
}

// readPoundSExp : String Number -> SExp
// based on http://docs.racket-lang.org/reference/reader.html#%28part._default-readtable-dispatch%29
// NOTE: bytestrings, regexps, hashtables, graphs, reader and lang extensions are not supported
function readPoundSExp(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i
    , datum
    , msg;
  i++;
  column++; // skip over the pound sign

  // throwUnsupportedError : ErrorString token -> Error
  function throwUnsupportedError(errorStr, token) {
    msg = new types.Message([source, ":", line.toString(), ":", (column - 1).toString(), errorStr]);
    throwError(msg, new Location(startCol, startRow, iStart, token.length + 1), "Error-GenericReadError");
  }

  if (i < str.length) {
    var p = str.charAt(i).toLowerCase();
    // fl and fx Vectors, structs, and hashtables are not supported
    var unsupportedMatch = new RegExp("^(((fl|fx|s|hash|hasheq)[\[\(\{])|((rx|px)\#{0,1}\"))", 'g')
      , unsupportedTest = unsupportedMatch.exec(str.slice(i));
    // Reader or Language Extensions are not allowed
    var badExtensionMatch = /^(!(?!\/)|reader|lang[\s]{0,1})/
      , badExtensionTest = badExtensionMatch.exec(str.slice(i));
    // Case sensitivity flags ARE allowed
    var caseSensitiveMatch = new RegExp("^(c|C)(i|I|s|S)")
      , caseSensitiveTest = caseSensitiveMatch.exec(str.slice(i));
    // Vector literals ARE allowed
    var vectorMatch = new RegExp("^([0-9]*)[\[\(\{]", 'g')
      , vectorTest = vectorMatch.exec(str.slice(i));
    if (unsupportedTest && unsupportedTest[0].length > 0) {
      var sexp = readSExpByIndex(str, i + unsupportedTest[0].length - 1)
        , kind, span = unsupportedTest[0].length, // save different error strings and spans
        base = unsupportedTest[0].replace(/[\(\[\{\"|#\"]/g, '');
      switch (base) {
        case "fl":
          kind = "flvectors";
          break;
        case "fx":
          kind = "fxvectors";
          break;
        case "s":
          kind = "structs";
          break;
        case "hash":
        case "hasheq":
          kind = "hashtables";
          break;
        case "px":
        case "rx":
          kind = "regular expressions";
          break;
        default:
          throw "IMPOSSIBLE: unsupportedMatch captured something it shouldn't: " + base;
      }
      msg = new types.Message([source, ":", line.toString(), ":", "0", ": read-syntax: literal " + kind + " not allowed"]);
      datum = new unsupportedExpr(sexp, msg, span);
      datum.location = new Location(startCol, startRow, iStart, unsupportedTest[0].length + sexp.location.span);
      return datum;
    } else if (badExtensionTest && badExtensionTest[0].length > 0) {
      throwUnsupportedError(": read: #" + badExtensionTest[0].trim() + " not enabled in the current context", badExtensionTest[0]);
    } else if (caseSensitiveTest && caseSensitiveTest[0].length > 0) {
      caseSensitiveSymbols = (caseSensitiveTest[0].toLowerCase() === "cs");
      i += 2;
      column += 2;
      return readSExpByIndex(str, i);
    } else if (vectorTest && vectorTest[0].length > 0) {
      var size = (vectorTest[1]) ? parseInt(vectorTest[1]) : "", // do we have a size string?
        sizeChars = size.toString().length; // how long is the size string?
      i += sizeChars;
      column += sizeChars // start reading after the vectorsize was specified
      var elts = readList(str, i)
        , len = size === "" ? elts.length : parseInt(vectorTest[1]); // set the size to a number
      // test vector size
      if (elts.length > len) {
        msg = new types.Message(["read: vector length " + len + " is too small, "
          , elts.length + " value" + ((elts.length > 1) ? "s" : "")
          , " provided"
        ]);
        throwError(msg, new Location(startCol, startRow, iStart, vectorTest[0].length));
      }

      i += elts.location.span;
      datum = new literal(new types.Vector(len, elts));
      datum.location = new Location(startCol, startRow, iStart, i - iStart);
      return datum;
    } else {
      // match every valid (or *almost-valid*) sequence of characters, or the empty string
      var poundChunk = new RegExp("^(hasheq|hash|fl|fx|\\d+|true|false|[tfeibdox]|\\<\\<|[\\\\\\\"\\%\\:\\&\\|\\;\\!\\`\\,\\']|)", 'i')
        , chunk = poundChunk.exec(str.slice(i))[0], // match the next character
        nextChar = str.charAt(i + chunk.length);
      // grab the first non-whitespace character
      p = chunk.charAt(0).toLowerCase();
      switch (p) {
        // CHARACTERS
        case '\\':
          datum = readChar(str, i - 1);
          i += datum.location.span - 1;
          break;
          // BYTE-STRINGS (unsupported)
        case '"':
          throwUnsupportedError(": byte strings are not supported in WeScheme", "#\"");
          break;
          // SYMBOLS
        case '%':
          datum = readSymbolOrNumber(str, i);
          datum.val = '#' + datum.val;
          i += datum.location.span;
          break;
          // KEYWORDS (lex to a symbol, then strip out the contents)
        case ':':
          datum = readSymbolOrNumber(str, i - 1);
          msg = new types.Message([source, ":", line.toString(), ":", "0", ": read-syntax: Keyword internment is not supported in WeScheme"]);
          datum = new unsupportedExpr(datum.val, msg, datum.location.span);
          i += datum.val.length - 1;
          break;
          // BOXES
        case '&':
          column++;
          sexp = readSExpByIndex(str, i + 1);
          var boxCall = new symbolExpr("box")
          datum = [boxCall, sexp];
          i += sexp.location.span + 1;
          boxCall.location = new Location(startCol, startRow, iStart, i - iStart);
          break;
          // BLOCK COMMENTS
        case '|':
          i--;
          datum = readBlockComment(str, i);
          i += datum.location.span + 1;
          break;
          // SEXP COMMENTS
        case ';':
          datum = readSExpComment(str, i + 1);
          i += datum.location.span + 1;
          break;
          // LINE COMMENTS
        case '!':
          datum = readLineComment(str, i - 1);
          i += datum.location.span;
          break;
          // SYNTAX QUOTES, UNQUOTES, AND QUASIQUOTES
        case '`':
        case ',':
        case '\'':
          datum = readQuote(str, i);
          datum.location.startChar--;
          datum.location.span++; // expand the datum to include leading '#'
          endOfError = i + datum.location.span;
          msg = new types.Message([source, ":", startRow.toString(), ":", (column - 1).toString(), " read: WeScheme does not support the '#" + p + "' notation for ", (p === "," ? "unsyntax" : p === "'" ? "syntax" : "quasisyntax")]);
          throwError(msg, datum.location);
          break;
          // STRINGS
        case '<<':
          datum = readString(str, i - 1);
          i += datum.location.span;
          break;
          // NUMBERS
        case 'e': // exact
        case 'i': // inexact
        case 'b': // binary
        case 'o': // octal
        case 'd': // decimal
        case 'x': // hexadecimal
          column--; //  back up the column one char
          datum = readSymbolOrNumber(str, i - 1);
          i += datum.location.span - 1;
          break;
          // BOOLEANS
        case 'true':
        case 'false':
        case 't': // true
        case 'f': // false
          if (!matchUntilDelim.exec(nextChar)) { // if there's no other chars aside from space or delims...
            datum = new literal(p === 't' || chunk === 'true'); // create a Boolean literal
            i += chunk.length;
            column += chunk.length; // move i/col ahead by the char
            break;
          }
          // otherwise fallthrough
        default:
          endOfError = i; // remember where we are, so readList can pick up reading
          msg = new types.Message([source, ":", line.toString(), ":", (column - 1).toString(), ": read: bad syntax `#", (chunk + nextChar), "'"]);
          throwError(msg, new Location(startCol, startRow, iStart, (chunk + nextChar).length + 1), "Error-GenericReadError");
      }
    }
    // only reached if # is the end of the string...
  } else {
    endOfError = i; // remember where we are, so readList can pick up reading
    throwError(new types.Message([source, ":", line.toString(), ":", (column - 1).toString(), ": read: bad syntax `#'"]), new Location(startCol, startRow, iStart, i - iStart), "Error-GenericReadError");
  }
  datum.location = new Location(startCol, startRow, iStart, i - iStart);
  return datum;
}

// readChar : String Number -> types.char
// reads a character encoded in the string and returns a representative datum
// see http://docs.racket-lang.org/reference/reader.html#%28part._parse-character%29
function readChar(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i
    , match;
  i += 2;
  column++; // skip over the #\\
  var datum = ""
    , isFirstChar = true
    , regexp;

  // read until we hit the end of the string, another char, or whitespace when it's not the first char
  while (i < str.length && (str.slice(i, i + 2) !== "#\\") && !(!isFirstChar && (isWhiteSpace(str.charAt(i)) || isDelim(str.charAt(i))))) {
    isFirstChar = false;
    column++;
    datum += str.charAt(i++);
  }

  // a special char is one of the following, as long as the next char is not alphabetic
  // unlike DrRacket, there is no JS equivalent for nul, null, page and rubout
  var special = new RegExp("(backspace|tab|newline|space|vtab)[^a-zA-Z]*", "i")
  match = special.exec(datum);
  // check for special chars
  if (special.test(datum)) {
    datum = datum === 'backspace' ? '\b' :
      datum === 'tab' ? '\t' :
      datum === 'newline' ? '\n' :
      datum === 'space' ? ' ' :
      datum === 'vtab' ? '\v' :
      "Impossible: unknown special char was matched by special char!";
    i = iStart + 2 + match[1].length; // set the reader to the end of the char

    // octal charCodes
  } else if (/^[0-9].*/.test(datum) // if it starts with a number...
    && oct3.test(datum) // it had better have some octal digits..
    && (oct3.exec(datum)[0] === datum) // in fact, all of them should be octal..
    && (parseInt(oct3.exec(datum)[0], 8) < 256) // and less than 256...
    && (parseInt(oct3.exec(datum)[0], 8) > 31) // and greater than 31,
  ) {
    match = /[0-7]+/.exec(datum)[0];
    datum = String.fromCharCode(parseInt(match, 8));
    i = iStart + 2 + match.length; // set the reader to the end of the char

    // check for hex4 or hex6
  } else if (/[uU]/.test(datum) // if it declares itself to be hexidecimal...
    && (regexp = datum.charAt(0) === "u" ? hex4 : hex6) // and we have a regexp for it...
    && regexp.test(datum.slice(1)) // and it's a valid hex code for that regexp...
  ) {
    match = regexp.exec(datum.slice(1))[0];
    column += (match.length - datum.length) + 1; // adjust column if only a subset of the datum matched
    datum = String.fromCharCode(parseInt(match, 16));
    i = iStart + 3 + match.length; // fast-forward past (1) hash, (2) backslash, (3) u and (4) number
    // check for a single character, or a character that is NOT followed by a unicode-alphabetic character
  } else if (datum.length === 1 || /[^\u00C0-\u1FFF\u2C00-\uD7FF\w]$/.test(datum.charAt(1))) {
    datum = datum.charAt(0);
    i = iStart + 3; // fast-forward past (1) hash, (2) backslash and (3) single char
  } else {
    throwError(new types.Message([source, ":", startRow.toString(), ":", (startCol - 1).toString()
        , ": read: bad character constant: #\\", datum
      ])
      , new Location(startCol - 1, startRow, iStart, i - iStart)
      , "Error-GenericReadError");
  }
  var chr = new literal(new types['char'](datum));
  chr.location = new Location(startCol, startRow, iStart, i - iStart);
  return chr;
}

// readBlockComment : String Number -> Atom
// reads a multiline comment
function readBlockComment(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i;
  i += 2;
  column += 2; // skip over the #|
  var txt = "";
  while (i + 1 < str.length && !(str.charAt(i) === '|' && str.charAt(i + 1) === '#')) {
    // check for newlines
    if (str.charAt(i) === "\n") {
      line++;
      column = 0;
    }
    txt += str.charAt(i);
    i++;
    column++; // move ahead
  }
  if (i + 1 >= str.length) {
    throwError(new types.Message(["read: Unexpected EOF when reading a multiline comment"]), new Location(startCol, startRow, iStart, i - iStart));
  }
  i++;
  column++; // hop over '|#'
  var comment = new compiler.comment(txt);
  comment.location = new Location(startCol, startRow, iStart, i - iStart);
  return comment;
}

// readSExpComment : String Number -> Atom
// reads exactly one SExp and ignores it entirely
function readSExpComment(str, i) {
  var startCol = column++
    , startRow = line
    , iStart = i
    , nextSExp;
  // keep reading s-exprs while...
  while ((i = chewWhiteSpace(str, i)) && // there's whitespace to chew
    (i + 1 < str.length) && // we're not out of string
    (nextSExp = readSExpByIndex(str, i)) && // there's an s-expr to be read
    (nextSExp instanceof comment)) { // and it's not a comment
    i = nextSExp.location.endChar;
  }

  // if we're done reading, make sure we didn't read past the end of the file
  if (i + 1 >= str.length) {
    endOfError = i; // remember where we are, so readList can pick up reading
    throwError(new types.Message([source, ":", startRow.toString(), ":", (startCol - 1).toString(), ": read: expected a commented-out element for `#;' (found end-of-file)"]), new Location(startCol - 1, startRow, i - 2, 2) // back up the startChar before #;, make the span include only those 2


      
      , "Error-GenericReadError");
  }
  // if we're here, then we read a proper s-expr
  var atom = new comment("(" + nextSExp.toString() + ")");
  i = nextSExp.location.endChar;
  atom.location = new Location(startCol, startRow, iStart, i - iStart);
  return atom;
}

// readLineComment : String Number -> Atom
// reads a single line comment
function readLineComment(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i;
  i++;
  column++; // skip over the ;
  var txt = "";
  while (i < str.length && str.charAt(i) !== '\n') {
    // track column values while we scan
    txt += str.charAt(i);
    column++;
    i++;
  }
  if (i > str.length) {
    endOfError = i; // remember where we are, so readList can pick up reading
    throwError(new types.Message(["read: Unexpected EOF when reading a line comment"])
      , new Location(startCol, startRow, iStart, i - iStart));
  }
  var atom = new comment(txt.replace(/^[\;\s]*/,'')); // remove starting WS or ;s
  atom.location = new Location(startCol, startRow, iStart, i + 1 - iStart);
  // at the end of the line, reset line/col values
  line++;
  column = 0;
  return atom;
}

// readQuote : String Number -> SExp
// reads a quote, quasiquote, or unquote encoded as a string
// NOT OPTIMIZED BY V8, due to presence of try/catch
function readQuote(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i
    , nextSExp;
  var p = str.charAt(i);
  var symbol = p == "'" ? new symbolExpr("quote") :
    p == "`" ? new symbolExpr("quasiquote") :
    /* else */
    "";

  function eofError(i) {
    endOfError = i + 1; // remember where we are, so readList can pick up reading
    var action = p == "'" ? " quoting " :
      p == "`" ? " quasiquoting " :
      p == "," ? " unquoting " :
      p == ",@" ? " unquoting " :
      /* else */
      "";
    throwError(new types.Message([source, ":", startRow.toString(), ":", startCol.toString(), ": read: expected an element for" + action, p, " (found end-of-file)"]), new Location(startCol, startRow, iStart, p.length), "Error-GenericReadError");
  }
  if (i + 1 >= str.length) {
    eofError(i);
  }
  i++;
  column++; // read forward one char
  if (p == ',') {
    if (str.charAt(i) == '@') {
      i++;
      column++;
      p += '@'; // read forward one char, and add @ to the option
      symbol = new symbolExpr("unquote-splicing");
    } else {
      symbol = new symbolExpr("unquote");
    }
  }

  symbol.location = new Location(column - 1, startRow, iStart, i - iStart);

  // read the next non-comment sexp
  while (!nextSExp || (nextSExp instanceof comment)) {
    i = chewWhiteSpace(str, i);
    try {
      nextSExp = readSExpByIndex(str, i);
    } catch (e) {
      // if it's the end of file, throw a special EOF for quoting
      if (/read\: \(found end-of-file\)/.test(e)) eofError(i);
      var unexpected = /expected a .* to open \",\"(.)\"/.exec(e);
      if (unexpected) {
        endOfError = i + 1; // remember where we are, so readList can pick up reading
        throwError(new types.Message([source, ":", line.toString(), ":", column.toString(), ": read: unexpected `" + unexpected[1] + "'"]), new Location(column, line, i, 1), "Error-GenericReadError");
      }
      throw e;
    }
    i = nextSExp.location.end().startChar + 1;
  }
  var quotedSexp = [symbol, nextSExp]
    , quotedSpan = (nextSExp.location.end().startChar + 1) - iStart;

  quotedSexp.location = new Location(startCol, startRow, iStart, quotedSpan);
  return quotedSexp;
}


// readSymbolOrNumber : String Number -> symbolExpr | types.Number
// NOT OPTIMIZED BY V8, due to presence of try/catch
function readSymbolOrNumber(str, i) {
  var startCol = column
    , startRow = line
    , iStart = i
    , j;
  // match anything consisting of stuff between two |bars|, **OR**
  // non-whitespace characters that do not include:  ( ) { } [ ] , ' ` | \\ " ;
  var symOrNum = new RegExp("(\\|(.|\\n)*\\||\\\\(.|\\n)|[^\\(\\)\\{\\}\\[\\]\\,\\'\\`\\s\\\"\\;])+", 'mg');
  var chunk = symOrNum.exec(str.slice(i))[0];
  // if there's an unescaped backslash at the end, throw an error
  var trailingEscs = /\.*\\+$/.exec(chunk);
  if (trailingEscs && (trailingEscs[0].length % 2 > 0)) {
    i = str.length; // jump to the end of the string
    endOfError = i; // remember where we are, so readList can pick up reading
    throwError(new types.Message([source, ":", line.toString(), ":", startCol.toString()
      , ": read: EOF following `\\' in symbol"
    ]), new Location(startCol, startRow, iStart, i - iStart), "Error-GenericReadError");
  }
  // move the read head and column tracker forward
  i += chunk.length;
  column += chunk.length;

  // remove escapes
  var unescaped = "";
  for (j = 0; j < chunk.length; j++) {
    if (chunk.charAt(j) == "\\") {
      j++;
    } // if it's an escape char, skip over it and add the next one
    unescaped += chunk.charAt(j);
  }
  // split the chunk at each |
  var chunks = unescaped.split("|");
  // check for unbalanced |'s, and generate an error that begins at the last one
  // and extends for the remainder of the string
  if (((chunks.length % 2) === 0)) {
    endOfError = str.length;
    var sizeOfLastChunk = chunks[chunks.length - 1].length + 1, // add 1 for the starting '|'
      strBeforeLastChunk = chunk.slice(0, chunk.length - sizeOfLastChunk)
      , lastVerbatimMarkerIndex = iStart + strBeforeLastChunk.length;
    // We need to go back and get more precise location information
    column = startCol;
    for (j = 0; j < strBeforeLastChunk.length; j++) {
      if (str.charAt(i) === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
    }
    throwError(new types.Message([source, ":", line.toString(), ":", column.toString()
      , ": read: unbalanced `|'"
    ]), new Location(column, line, lastVerbatimMarkerIndex, str.length - lastVerbatimMarkerIndex), "Error-GenericReadError");
  }

  // enforce case-sensitivity for non-verbatim sections.
  var filtered = chunks.reduce(function(acc, str, i) {
    // if we're inside a verbatim portion (i is even) *or* we're case sensitive, preserve case
    return acc += (i % 2 || caseSensitiveSymbols) ? str : str.toLowerCase();
  }, "");

  // if it's a newline, adjust line and column trackers
  if (filtered === "\n") {
    line++;
    column = 0;
  }

  // add bars if it's a symbol that needs those escape characters, or if the original string used an escaped number
  var special_chars = new RegExp("^$|[\\(\\)\\{\\}\\[\\]\\,\\'\\`\\s\\\"\\\\]", 'g');
  var escaped_nums = new RegExp("^.*\\\\[\\d]*.*|\\|[\\d]*\\|");
  filtered = (escaped_nums.test(chunk) || special_chars.test(filtered) ? "|" + filtered + "|" : filtered);

  // PERF: start out assuming it's a symbol...
  var node = new symbolExpr(filtered);
  // PERF: if it's not trivially a symbol, we take the hit of jsnums.fromString()
  if ((chunks.length === 1) && !/^[a-zA-Z\-\?]+$/.test(filtered)) {
    // attempt to parse using jsnums.fromString(), assign to sexp and add location
    // if it's a bad number, throw an error
    try {
      var numValue = jsnums.fromString(filtered, true);
      // If it's a number (don't interpret zero as 'false'), that's our node
      if (numValue || numValue === 0) {
        if (numValue instanceof Object) {
          numValue.stx = filtered;
          numValue.location = new Location(startCol, startRow, iStart, i - iStart);
        }
        node = new literal(numValue);
      }
      // if it's not a number OR a symbol
    } catch (e) {
      endOfError = i; // remember where we are, so readList can pick up reading
      var msg = new types.Message([source, ":", startRow.toString(), ":", startCol.toString(), ": read: " + e.message]);
      throwError(msg, new Location(startCol, startRow, iStart, i - iStart), "Error-GenericReadError");
    }
  }
  node.stx = filtered; // save the string that generated the symbol/number to begin with
  node.location = new Location(startCol, startRow, iStart, i - iStart);
  return node;
}
/////////////////////
/* Export Bindings */
/////////////////////
export var lex = function(str, strSource, debug) {
  var start = new Date().getTime();
  try {
    var sexp = readProg(str, strSource);
  } // do the actual work
  catch (e) {
    console.log("LEXING ERROR");
    throw e;
  }
  var end = new Date().getTime();
  if (debug) {
    console.log("Lexed in " + (Math.floor(end - start)) + "ms");
    console.log(sexp);
    console.log(sexpToString(sexp));
  }
  return sexp;
};