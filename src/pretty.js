
/******************************************************************************
 * Constructors (shorthand constructors for Docs)
 ******************************************************************************/

export function empty() {
  return new EmptyDoc();
}
export function txt(text) {
  if (text.indexOf("\n") !== -1) {
    throw "pretty.js: The `txt` function does not accept text with newlines, but was given: " + text;
  }
  return new TextDoc(text);
}
export function horz() {
  let args = Array.from(arguments);
  return args.reduce((result, doc) => new HorzDoc(result, doc));
}
export function vert() {
  let args = Array.from(arguments);
  return args.reduce((result, doc) => new VertDoc(result, doc));
}
export function concat() {
  let args = Array.from(arguments);
  return args.reduce((result, doc) => new ConcatDoc(result, doc));
}
export function ifFlat(doc1, doc2) {
  return new IfFlatDoc(doc1, doc2);
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

  render(out, indent, column, width) {
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
      // It's a value part. It _should_ already be a Doc, but if
      // someone was lazy it might just be a string, in which case we
      // should wrap it.
      let part = vals[(i - 1) / 2];
      lineParts.push(typeof part === 'string' ? txt(part) : part);
    }
  }
  // Remember to push the last line.
  lines.push(horz.apply(null, lineParts));
  return vert.apply(null, lines);
}

/******************************************************************************
 * Utility Constructors
 ******************************************************************************/

export function wrap(sep, items) {
  return items.reduce(
    (acc, item) =>
      concat(acc, ifFlat(horz(sep, item),
                         vert(empty(), item))))
}
