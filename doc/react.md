# React Notes

These are some general notes on the JS [React](https://reactjs.org/) library.
Mostly, they are a summary of the
[React tutorial](https://reactjs.org/docs/hello-world.html). If something isn't
clear here, that's a good place to look to try to get a deeper understanding.

Why are we using React? I see two big reasons:

1. React is smart about what to update, and doesn't needlessly update parts of
the DOM that haven't changed. This is good for efficiency.
2. React is an opinionated framework, with good opinions. It gives good
structure to CMB.


## React Overview

In React, your application is built up as a _Virtual DOM_, corresponding pretty
closely to the _actual DOM_ in the browser. Each node in this virtual DOM is
called an _Element_. A React Element can be constructed from a standard browser
element (e.g. `div`, `h1`, `img`), or from a user-defined kind of Element,
called a _Component_. That is to say: a Component can be instantiated (or
_rendered_) to produce an Element.

One of the very clever things that React does is to extend the syntax of
Javascript to allow you to construt Elements using HTML-tag-like notation. So,
for example, you can write a `Clock` Component, that renders itself using
standard HTML elements:

```javascript
class Clock extends React.Component {
  render() {
    return (
      <div>
        <h1>Hello, world!</h1>
        <h2>It is {this.props.date.toLocaleTimeString()}.</h2>
      </div>
    );
  }
}
```

This `Clock` Component can then be used as the name of a tag, to produce a
`Clock` _Element_. This allows nesting Components inside one another.

In the end, the root of the DOM needs to be hooked into a place in the actual
browser DOM, via a function called `ReactDOM.render`. In this example, if we
just want to render the clock, we can say:

```javascript
ReactDOM.render(
  <Clock />,
  document.getElementById('root')
);
```

Most of the rest of React is additional features that you can add to a
Component. For example, this clock is stateless and does not update itself;
there are features to fix that.

## React Elements

These three definitions produce approximately the same thing, a _React Element_:

```javascript
const element = (
  <h1 className="greeting">
    Hello, world!
  </h1>
);

const element = React.createElement(
  'h1',
  {className: 'greeting'},
  'Hello, world!'
);

// Note: this structure is simplified
const element = {
  type: 'h1',
  props: {
  className: 'greeting',
  children: 'Hello, world!'
  }
};
```

React Elements are the nodes that make up the virtual DOM tree that represents
the state of your application. They are **immutable**.


### JSX

React's JSX is the syntactic extension to Javascript that allows you to write
that first example, that looks like HTML tags. JSX makes exactly three
extensions to the syntax:

- `<tag attr=value ...> ...children... </tag>` in expression position constructs
  a React Element. `tag` can be either a built-in tag, like `img`, or a
  user-defined `Component`. The former are always lowercase, and the latter
  always uppercase!
- `<tag />` is shorthand for `<tag></tag>`.
- Curly braces escape to Javascript. Any JS expression is allowed inside.

You can use curly-brace escapes in a variety of ways. They can:

- Fill in the value of an attribute as a string. It will be automatically
  escaped. For example, `<img src={imgPath} />`.
- Fill in a child of the node, by using a JS expression that evaluates to a
  React Element. For example, `<li>{number}</li>`.
- Fill in a _sequence_ of children, by using a JS expression that evaluates to
  an _array_ of React Elements. For example, `<ul>{listItems}</ul>`. If you do
  this, each child should have a distinct `key` attribute.
- Fill in an event handler with a function. For example, `<form
  onSubmit={this.handleSubmit}>`.

### Some additional notes:

- Tags in comments are evaluated! Beware!
- JSX is also the name of [an entirely unrelated thing](https://jsx.github.io/).
- Unlike real HTML, all tags must be closed, and there are no weird rules about
which tags are allowed to be self-closed (e.g. `<tag/>`) and which aren't.
- Tags sometimes need to be enclosed in parens, presumably to help with parsing.
The tutorial doesn't seem to give any rules about when this is needed.


## React Components

There are two ways to define React _Components_ (i.e., things that can be used
as a JSX tag):

```javascript
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}

class Welcome extends React.Component {
  render() {
    return <h1>Hello, {this.props.name}</h1>;
  }
}
```

They are equivalent, except that you can do some fancy things with the class
approach. A Component should return a React Element, or `null` if it wants to
hide itself.

The `props` argument (alternatively `this.props`) is a dictionary that holds the
attributes that were passed to this Component as it was constructed (typically
via a JSX tag).

There is a special `props.children` field that holds all of a node's children.

### State

A Component class can have a magic field called `this.state`. It should be set
in the constructor, and can be updated with `this.setState(newValue)`. When the
state is updated, React will re-render the Component.

**`setState` updates the state _asynchronously_.** Thus, when you call
`setState`, the _previous_ state (accessed via `this.state`) may be out of date.
Likewise, _after_ calling `setState`, you cannot rely on `this.state` showing
the new state (nor even the previous state!).

This _would_ often make it impossible to correctly write a program involving
state. But fortunately, if you pass a callback to `setState`, it will let you do
a synchronous update. For example:

```javascript
this.setState((state, props) => ({
  counter: state.counter + props.increment
}));
```

So you get to manually CPS your program to make it correct. Yay!

In short, **if the previous value of the state influences the next value in any
way, you must use the callback version of `setState`**. Furthermore,
_everything_ that depends on the new state must also go in the closure.

### Lifecycle

A Component class can have `componentDidMount()` and `componentWillUnmount()`
methods; React will call these just after one is built, and just before one is
destroyed. These can be useful for setup and teardown.

### Events

Some HTML elements have an attribute that can be set to an event handler, like
`onClick`. In React, this is done by providing it a JS function. For example:

```javascript
<button onClick={this.handleClick}>
```

Some tips:

- JS class methods don't bind `self` when mentioned by name. So you probably
  want to write `handleClick = e => ...` in the class, rather than
  `handleClick() { ... }`.
- To prevent an event from _also_ having its default behavior, call
  `e.preventDefault()`. (In JS, you could just return `false` from the handler;
  not so here.)

## Suggestions for using React

- React has exactly one rule. **Obey the one rule**:
      > All React Components must act like pure functions with respect to their props.
- To share state, put it in its closest common ancestor.
- Don't use inheritance.

## Continue Reading

For a more detailed overview of how React goes about its business, see
[React's Algorithm](react-algorithm.md).
