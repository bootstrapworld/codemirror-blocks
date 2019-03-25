# Pretty Printing Guide

[TODO] This documentation was written early in the development of this
project. Before releasing it, check it all against the code, which may
have changed in the meantime.

This is a brief overview of how to define your language's pretty
printing functions, which describe how to display them as text.

More specifically, each of your blocks must have a method called
`pretty()` which returns a pretty printing `Doc`, as defined by
`src/pretty.js`. A `Doc` is a data structure describing how to display
your blocks as text. It's different than a string because it can adapt
the layout of the code based on the screen width: the method
`.display(width)` renders the `Doc` within the given width, and
returns a list of lines.

## Kinds of Docs

There are just six primitive constructors for `Doc`s:

#### Empty

`empty()` is an empty document. It doesn't print anything.

#### Text

`txt(string)` is literal text, _which cannot contain newlines._ It
just prints itself.

#### Horizontal Concatenation

`horz(doc1, doc2, ...)` concatenates documents from left to right. The
  horizontal concatenation of two documents `x` and `y` looks like this:

    xxxxx
    xxxxx
    xxyyyyy
      yyyy    // notice that this line is indented to match the first

If instead of a fixed number of documents, you have an array of them,
you can instead use `horzArray(docArray)`, which is equivalent to
`horz.apply(null, docArray)`.

#### Simple Concatenation

`concat(doc1, doc2, ...)` concatenates documents from left to right.
It is similar to `horiz`, except that it does not change the
indentation of the second document. Thus the simple concatenation of
two documents `x` and `y` looks like this:

    xxxxx
    xxxxx
    xxyyyyy
    yyyy      // notice that this line is not indented

Most of the time, you should prefer `horz` over `concat`.

If instead of a fixed number of documents, you have an array of them,
you can use `concatArray(docArray)`.


#### Vertical Concatenation

`vert(doc1, doc2, ...)` concatenates documents from top to bottom. The
  vertical concatenation of two documents `x` and `y` looks like this:

    xxxxx
    xxxxx
    xx
    yyyyy
    yyyy

If instead of a fixed number of documents, you have an array of them,
you can use `vertArray(docArray)`


#### IfFlat: Choose between two Layouts

`ifFlat(doc1, doc2)` lets you choose between two documents.
It will use `doc1` if it fits entirely on the current line, otherwise
it will use `doc2`.

More precisely, `doc1` will be used iff:

1. It can be rendered flat. A "flat" document has no newlines,
   i.e., no `vert`.
2. When rendered flat, it fits on the current line without going over
a   the pretty printing width.

**Sidenote:** This seems like an oddly specific way of implementing
choice, doesn't it? We use it because it allows the pretty printing
algorithm to run in linear time (linear in the size of the document,
with no dependence on the pretty printing width). Overall, our pretty
printing approach is a mix of Wadler's
[Prettier Printer](http://homepages.inf.ed.ac.uk/wadler/papers/prettier/prettier.pdf),
and Bernardy's
[Pretty but not Greedy Printer](https://jyp.github.io/pdf/Prettiest.pdf).


#### FullLine: Prevent More on the Same Line

Finally, `fullLine(doc)` ensures that nothing is placed after `doc`, if at all
possible. For example this doc:

    horz(ifFlat("a", vert("a", "A")), "b")

renders as:

    ab

However, if you wrap `a` in a `fullLine`:

    horz(ifFlat(fullLine("a"), vert("a", "A")), "b")

then the `fullLine` will disallow anything from being placed after the `a` on
the same line, and as a result the `ifFlat` will choose the other option,
rendering as:

    a
    Ab

This is helpful for line comments. For example, `fullLine("// comment")` will
ensure that (if at all possible) nothing is placed after the comment.

## Putting it all Together

Let's put all of this together with an example. We'll look at how to use these
constructs to pretty print functions in a language called [Pyret](pyret.org).
Pyret functions can be displayed either on multiple lines:

    fun greet(name):
        "Welcome back, " + name
    end

or on one line:

    fun greet(name): "Welcome back, " + name end

Here is how you can define a method that pretty prints these functions in either
of the two styles above, putting everything on one line if it fits within the
given line width, and splitting it up across multiple lines if it doesn't:

    class Function extends ASTNode {
      ...
      pretty() {
        let name = this.name.pretty();
        let args = this.args.pretty();
        let body = this.body.pretty();

        let header = horz(txt("fun "), name, txt("("), args, txt("):"));
        let onOneLine = horz(header, txt(" "), body, txt(" end"));
        let onMultipleLines = vert(header, horz(txt("    "), body), txt("end"));

        return ifFlat(onOneLine, onMultipleLines);
      }
    }

There are a couple lessons to learn from this example:

- If you want to allow something to be displayed in more than one way---like the
  two ways that a function can be displayed here---then you must use `ifFlat`.
  It is the only "choice" operator.
- To indent a chunk of code by a fixed amount, use `horz` and spaces. In this
  example, we used `horz(txt("    "), body)` to indent `body` by 4 spaces. (And
  typically, you'll want to stick _that_ inside a `vert`, to combine it with the
  code above and below.)

## Other Constructors

Besides the primitive constructors, there are some other useful
"utility" constructors. These constructors don't provide any extra power, as
they are all defined in terms of the "primitive" constructors described above.
But they capture some useful pretty printing patterns.

#### Wrap

`wrap(sep, items)` combines the items with `sep`, or with a newline
when necessary. For example, when given a list of words, this produces
a paragraph that automatially line-wraps to fit the available space.

#### String Templates

There is also a
[string template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
shorthand for building a `doc`, called `pretty`. For example, this
function:

    function ifte2(c, t, e) {
      return ifFlat(
        pretty`if (${c}) { ${t} } else { ${e} }`,
        pretty`if (${c}) {\n  ${t}\n} else {\n  ${e}\n}`);
    }

pretty prints `if` statements, and allows them to either be on one
line or split across many:

    if (a == b) { a << 2 } else { a + b }

    if (a == b) {
      a << 2
    } else {
      a + b
    }

The `pretty` template accepts template strings that may contain
newlines. It combines the lines with `vert`, and the parts of each
line with `horz`.


### S-Expression Constructors

There are also some constructors for common kinds of s-expressions:

#### Standard

`standardSexpr(func, args)` is rendered like this:

     (func args ... args)

or like this:

     (func
      args
      ...
      args)

#### Lambda-like

`lambdaLikeSexpr(keyword, defn, body)` is rendered like this:

    (keyword defn
      body)

#### Begin-like

`export function beginLikeSexpr(keyword, bodies)` is rendered like this:

    (keyword
      bodies
      ...
      bodies)


## Shortcuts

When constructing a `Doc`, for example with `horz`, all of the
arguments should themselves be `Doc`s. However, the library allows
some leniency in this: if you pass a String instead of a `Doc`, it
will be wrapped in `txt`, and if you pass an object with a `pretty()`
method, that method will be called.
