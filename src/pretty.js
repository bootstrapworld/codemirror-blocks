
/******************************************************************************
 * Constructors (shorthand constructors for Docs)
 ******************************************************************************/

export function empty() {
  return new EmptyDoc();
}
export function txt(arg) {
  let text = arg.toString(); // coerce to a string if it isn't already
  if (text.indexOf("\n") !== -1) {
    throw "pretty.js: The `txt` function does not accept text with newlines, but was given: " + text;
  }
  return new TextDoc(text);
}
export function horz() {
  return horzArray(Array.from(arguments));
}
export function vert() {
  return vertArray(Array.from(arguments));
}
export function concat() {
  return concatArray(Array.from(arguments));
}
export function horzArray(array) {
  let docArray = array.map(item => coerce(item));
  return docArray.reduce((result, doc) => new HorzDoc(result, doc));
}
export function vertArray(array) {
  let docArray = array.map(item => coerce(item));
  return docArray.reduce((result, doc) => new VertDoc(result, doc));
}
export function concatArray(array) {
  let docArray = array.map(item => coerce(item));
  return docArray.reduce((result, doc) => new ConcatDoc(result, doc));
}
export function ifFlat(flat, broken) {
  return new IfFlatDoc(coerce(flat), coerce(broken));
}
export function fullLine(doc) {
  return new FullLineDoc(coerce(doc))
}

/******************************************************************************
 * Documents
 * 
 *   display(width):
 *     "Pretty print a document within the given width. Returns a list of lines."
 * 
 *   render(out, indent, column, width):
 *     "Render the document. This is the recursive call of display()."
 *     out:    The list of lines to print to.
 *     indent: The column to return to in case of a line break.
 *     column: The current column.
 *     width:  The max width that the pretty printing is allowed to be.
 *     -> returns the current column after printing
 * 
 ******************************************************************************/

class Doc {
  constructor(flat_width) {
    this.flat_width = flat_width;
  }
  
  display(width) {
    let outputLines = [""];
    this.render(outputLines, 0, 0, width);
    return outputLines;
  }
}

class EmptyDoc extends Doc {
  constructor() {
    super(0);
  }

  render(_out, _indent, column, _width) {
    return column;
  }
}

class TextDoc extends Doc {
  constructor(text) {
    super(text.length);
    this.text = text;
  }

  render(out, indent, column, width) {
    out[out.length - 1] += this.text; // print the text to the last line
    return column + this.text.length;
  }
}

class HorzDoc extends Doc {
  constructor(doc1, doc2) {
    if (doc1.flat_width === null || doc2.flat_width === null) {
      super(null);
    } else {
      super(doc1.flat_width + doc2.flat_width);
    }
    this.doc1 = doc1;
    this.doc2 = doc2;
  }

  render(out, indent, column, width) {
    let newColumn = this.doc1.render(out, indent, column, width);
    return this.doc2.render(out, newColumn, newColumn, width);
  }
}

class ConcatDoc extends Doc {
  constructor(doc1, doc2) {
    if (doc1.flat_width === null || doc2.flat_width === null) {
      super(null);
    } else {
      super(doc1.flat_width + doc2.flat_width);
    }
    this.doc1 = doc1;
    this.doc2 = doc2;
  }

  render(out, indent, column, width) {
    let newColumn = this.doc1.render(out, indent, column, width);
    return this.doc2.render(out, indent, newColumn, width);
  }
}

class VertDoc extends Doc {
  constructor(doc1, doc2) {
    super(null);
    this.doc1 = doc1;
    this.doc2 = doc2;
  }

  render(out, indent, column, width) {
    this.doc1.render(out, indent, column, width);
    out.push(new Array(indent + 1).join(" ")); // print newline and indent
    return this.doc2.render(out, indent, indent, width);
  }
}

class FullLineDoc extends Doc {
  constructor(doc) {
    super(null);
    this.doc = doc;
  }

  render(out, indent, column, width) {
    return this.doc.render(out, indent, column, width);
  }
}

class IfFlatDoc extends Doc {
  constructor(flat, broken) {
    if (flat.flat_width === null) {
      super(broken.flat_width);
    } else if (broken.flat_width === null) {
      super(flat.flat_width);
    } else {
      super(Math.min(flat.flat_width, broken.flat_width));
    }
    this.flat = flat;
    this.broken = broken;
  }

  render(out, indent, column, width) {
    // The key to the efficiency of this whole pretty printing algorithm
    // is the fact that this conditional does not rely on rendering `this.flat`:
    let flat_width = this.flat.flat_width;
    if (flat_width !== null && column + flat_width <= width) {
      // If the "flat" doc fits on the line, use it.
      return this.flat.render(out, indent, column, width);
    } else {
      // Otherwise, use the "broken" doc.
      return this.broken.render(out, indent, column, width);
    }
  }
}

/******************************************************************************
 * String Templates
 ******************************************************************************/

export function pretty(strs, ...vals) {
  // Interpret a JS string template as a pretty printing Doc.
  let lines = new Array(); // The lines will be joined with `vert`.
  let lineParts = new Array(); // The parts of each line will be joined with `horz`.
  // Iterate over the parts of the template in order.
  for (let i = 0; i < strs.length + vals.length; i++) {
    if (i % 2 === 0) {
      // It's a string part. Split it into lines.
      let parts = strs[i / 2].split("\n");
      for (let j in parts) {
        let part = parts[j];
        // For every newline in the string, push a line.
        if (j != 0) {
          lines.push(horz.apply(null, lineParts));
          lineParts = new Array();
        }
        // The string must be wrapped in `txt` to become a Doc.
        lineParts.push(txt(part));
      }
    } else {
      // It's a value part. Add it.
      lineParts.push(vals[(i - 1) / 2]);
    }
  }
  // Remember to push the last line.
  lines.push(horz.apply(null, lineParts));
  return vert.apply(null, lines);
}

/******************************************************************************
 * Private Helper Functions
 ******************************************************************************/

// The user has given us a thing. If they were nice, it would be a Doc.
// But they're not nice, so it could be anything.
// Let's see if we can make it into a Doc.
function coerce(thing) {
  if (thing instanceof Doc) {
    return thing;
  } else if (typeof thing === 'string') {
    return txt(thing);
  } else if (typeof thing.pretty === 'function') {
    let doc = thing.pretty();
    if (!(doc instanceof Doc)) {
      // TODO: `+ thing` is an awful way to print something; replace with something better?
      throw new Error("The pretty printer called the `.pretty()` function, and expected it to return a Doc, but instead it returned: " + thing);
    }
    return doc;
  } else {
    // What did they give us? We can't work with this thing.
    throw new Error("The pretty printer was expecting a Doc (or a String, or something with a pretty() method), but instead it was given: " + thing);
  }
}

function intersperse(sep, items) {
  let array = new Array();
  for (let i in items) {
    if (i != 0) {
      array.push(sep);
    }
    array.push(items[i]);
  }
  return array;
}


/******************************************************************************
 * Utility Constructors
 ******************************************************************************/

// Display all items, with each pair of adjacent items separated
// either by `sep` or by `vertSep\n`. If `sep` is txt(" ") and
// `vertSep` is empty(), this implements word wrap.
// Neither `sep` nor `vertSep` may contain newlines.
export function wrap(sep, vertSep, items) {
  return items.reduce(
    (acc, item) =>
      concat(acc, ifFlat(horz(sep, item),
                         vert(vertSep, item))));
}

// Wrap items like `wrap()`, and additionally begin each line with `prefix`.
// This is useful for, e.g., a comment whose lines must start with `//`.
export function wrapAndPrefix(prefix, sep, vertSep, items) {
  return concat(prefix, items.reduce(
    (acc, item) =>
      concat(acc, ifFlat(horz(sep, item),
                         vert(vertSep, concat(prefix, item))))));
}

// Display either `items[0] sep items[1] sep ... items[n]`
// or `items[0] vertSep \n items[1] vertSep \n ... items[n]`.
// Neither `sep` nor `vertSep` may contain newlines.
export function sepBy(sep, vertSep, items) {
  let vertItems = items.map((item, i) => {
    return i == items.length - 1 ? item : horz(item, vertSep);
  });
  return ifFlat(horzArray(intersperse(sep, items)),
                vertArray(vertItems));
}

export function commaSep(items) {
  return sepBy(txt(", "), txt(","), items);
}

export function spaceSep(items) {
  return sepBy(txt(" "), empty(), items);
}

export function surround(open, close, center) {
  return horz(open, center, close);
}

export function parens(center) {
  return surround(txt("("), txt(")"), center);
}

export function brackets(center) {
  return surround(txt("["), txt("]"), center);
}

export function standardSexpr(func, args) {
  return parens(spaceSep([func].concat(args)));
}

export function lambdaLikeSexpr(keyword, defn, body) {
  return ifFlat(parens(spaceSep([keyword, defn, body])),
                parens(vert(horz(keyword, " ", defn),
                            horz(" ", body))));
}

export function beginLikeSexpr(keyword, bodies) {
  return parens(vert(keyword, horz(" ", vertArray(bodies))));
}

// Display a Scheme-style comment.
//
// - `doc` is what's being commented.
// - `comment` is the comment itself. If it is falsy, there is no comment.
// - `container` is the ast node that owns the comment. This argument is used to
//   determine if the comment is a line comment (appears after `container` on
//   the same line). Line comments will stay as line comments _as long as they
//   fit on the line_. If they don't, they'll be converted into a comment on the
//   previous line.
export function withSchemeComment(doc, comment, container) {
  if (comment) {
    // TODO: While this is very clever, it breaks if you drag a block with a
    // line comment into a drop target that has code after it.
    /*
    if (container) {
      if (container.to.line == comment.from.line) {
        // This is a line comment. Try to put it on the same line, if it fits.
        return ifFlat(horz(doc, " ", comment)),
                      vert(comment, doc));
      }
    }
    */
    return vert(comment, doc);
  } else {
    return doc;
  }
}
