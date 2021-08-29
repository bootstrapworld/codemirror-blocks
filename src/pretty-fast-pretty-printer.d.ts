// TODO: maybe move this into the pretty-fast-pretty-printer library...
declare module 'pretty-fast-pretty-printer' {
  export interface Doc {
    constructor(flat_width: number);
    display(width: number): string[];
  }

  export type DocLike = Doc | string | { pretty: () => Doc };

  /**
   * `txt(string)` simply displays `string`. The `string` cannot contain newlines.
   * `txt("")` is an empty document.
   *
   * For example,
   *
   * ```js
   *     txt("Hello, world")
   *       .display(80);
   * ```
   *
   * produces:
   *
   * <code style="background-color:#cde">Hello, world</code>
   *
   * All other combinators will automatically wrap string arguments in `txt`.
   * As a result, you can almost always write `"a string"` instead of `txt("a string")`.
   */
  export function txt(arg: string): Doc;

  /**
   * `horzArray(docArray)` is a variant of `horz` that takes a single argument that
   * is an array of documents. It is equivalent to `horz.apply(null, docArray)`.
   */
  export function horzArray(array: DocLike[]): Doc;

  /**
   * `horz(doc1, doc2, ...)` horizontally concatenates documents. The second document
   * is indented to match the last line of the first document (and so forth for the
   * third document, etc.). The horizontal concatention of two documents looks like
   * this:
   *
   * ![Horizontal concatenation image](https://raw.githubusercontent.com/brownplt/pretty-fast-pretty-printer/master/horz.png)
   *
   * For example,
   *
   * ```js
   *     horz("BEGIN ", vert("first line", "second line"))
   *       .display(80)
   * ```
   *
   * produces:
   *
   * <pre><code style="background-color:#cde">BEGIN first line
   *       second line
   * </code></pre>
   *
   * Horizontal concatenation is associative. Thus:
   *
   *       horz(X, Y, Z)
   *     = horz(X, horz(Y, Z))
   *     = horz(horz(X, Y), Z)
   */
  export function horz(...docs: DocLike[]): Doc;

  /**
   * `vert(doc1, doc2, ...)` vertically concatenates documents, from top to bottom.
   * (I.e., it joins them with newlines). The vertical concatenation of two
   * documents looks like this:
   *
   * ![Vertical concatenation image](https://raw.githubusercontent.com/brownplt/pretty-fast-pretty-printer/master/vert.png)
   *
   * For example,
   *
   * ```js
   *     vert("Hello,", "world!")
   *       .display(80)
   * ```
   *
   * produces:
   *
   * <pre><code style="background-color:#cde">Hello,
   * world!
   * </code></pre>
   *
   * Vertical concatenation is associative. Thus:
   *
   *       vert(X, Y, Z)
   *     = vert(X, vert(Y, Z))
   *     = vert(vert(X, Y), Z)
   */
  export function vert(...docs: DocLike[]): Doc;

  /**
   * `vertArray(docArray)` is a variant of `vert` that takes a single argument that
   * is an array of documents. It is equivalent to `vert.apply(null, docArray)`.
   */
  export function vertArray(docs: DocLike[]): Doc;

  /**
   * `concat(doc1, doc2, ...)` naively concatenates documents from left to right. It
   * is similar to `horz`, except that the indentation level is kept _fixed_ for
   * all of the documents. The simple concatenation of two documents looks like this:
   *
   * ![Simple concatenation image](https://raw.githubusercontent.com/brownplt/pretty-fast-pretty-printer/master/concat.png)
   *
   * You should almost always prefer `horz` over `concat`.
   *
   * As an example,
   *
   * ```js
   *     concat("BEGIN ", vert("first line", "second line"))
   *       .display(80))
   * ```
   *
   * produces:
   *
   * <pre><code style="background-color:#cde">BEGIN first line
   * second line
   * </code></pre>
   */
  export function concat(...docs: DocLike[]): Doc;

  /**
   * `concatArray(docArray)` is a variant of `concat` that takes a single argument
   * that is an array of documents. It is equivalent to `concat.apply(null, docArray)`.
   */
  export function concatArray(docs: DocLike[]): Doc;

  /**
   * `ifFlat(doc1, doc2)` chooses between two documents.
   * It will use doc1 if it fits entirely on the current line, otherwise it will use doc2.
   * More precisely, doc1 will be used iff:
   *   1. It can be rendered flat. A "flat" document has no newlines, i.e., no vert. And,
   *   2. When rendered flat, it fits on the current line without going over the
   *      pretty printing width.
   *
   * @param doc1 a document
   * @param doc2 another document
   */
  export function ifFlat(doc1: DocLike, doc2: DocLike): Doc;

  /**
   * ensures that nothing is placed after doc, if at all possible.
   * @param doc a document
   */
  export function fullLine(doc: DocLike): Doc;

  /**
   * `sepBy(items, sep, vertSep="")` will display either:
   *
   *     items[0] sep items[1] sep ... items[n]
   *
   * if it fits on one line, or:
   *
   *     items[0] vertSep \n items[1] vertSep \n ... items[n]
   *
   * otherwise. (Without the extra spaces; those are there for readability.)
   *
   * Neither `sep` nor `vertSep` may contain newlines.
   * @param items list of documents
   * @param sep separator string
   * @param vertSep vertical separator string
   */
  export function sepBy(
    items: DocLike[],
    sep?: string = ' ',
    vertSep?: string = ''
  ): Doc;

  /**
   * `wrap(words, sep=" ", vertSep="")` does word wrapping. It combines the `words` with
   * `sep` when they fit on the same line, or `vertSep\n` when they don't.
   *
   * For simple word wrapping, you would use:
   *
   *     wrap(words, " ", "") // or just wrap(words)
   *
   * For word-wrapping a comma-separated list, you would use:
   *
   *     wrap(words, ", ", ",")
   *
   * Neither `sep` nor `vertSep` may contain newlines.
   */
  export function wrap(
    words: DocLike[],
    sep?: string = ' ',
    vertSep?: string = ''
  ): Doc;

  /**
   * `standardSexpr(func, args)` is rendered like this:
   *
   *      (func args ... args)
   *
   * or like this:
   *
   *      (func
   *       args
   *       ...
   *       args)
   */
  export function standardSexpr(func: DocLike, args: DocLike[]): Doc;

  /**
   * `lambdaLikeSexpr(keyword, defn, body)` is rendered like this:
   *
   *     (keyword defn body)
   *
   * or like this:
   *
   *     (keyword defn
   *       body)
   */
  export function lambdaLikeSexpr(
    keyword: DocLike,
    defn: DocLike,
    body: DocLike
  ): Doc;

  /**
   * `beginLikeSexpr(keyword, bodies)` is rendered like this:
   *
   *     (keyword
   *       bodies
   *       ...
   *       bodies)
   */
  export function beginLikeSexpr(keyword: DocLike, bodies: DocLike[]): Doc;

  /**
   * shorthand for building a `doc`, called `pretty`. Itaccepts template strings that
   * may contain newlines. It combines the lines with `vert`, and the parts of each
   * line with `horz`. For example, this template:
   *
   * ```js
   *     pretty`if (${c}) {\n  ${t}\n} else {\n  ${e}\n}`)
   * ```
   *
   * pretty prints an `if` statement across multiple lines:
   *
   *     if (a == b) {
   *       a << 2
   *     } else {
   *       a + b
   *     }
   */
  export function pretty(strs: string[], ...vals: DocLike[]);
}
