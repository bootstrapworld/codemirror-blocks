# React's Algorithm

Sometimes it's important to have an idea of how React goes about its business of
updating the virtual DOM and updating the actual DOM. For example, you really
need to understand this well to implement `shouldComponentUpdate` correct.
However, I (Justin) wasn't able to get a good sense of this just from reading
the official docs, and this is my attempt to explain what wasn't clear to me.

## Types

None of this will make much sense if you don't have a good idea of what types of
data are involved:

### Components

Components are classes that extend `React.Component`. (They can also be
functions, which React calls "function components", but for simplicity I'm going
to ignore that and assume they're always classes.)

It would be normal to say "x is a Component" to mean "x is an object that is an
instance of the `Component` class". I won't do that. When I say "x is a
Component", I mean that x is a _class_, not an object. This is unfortunately
necessary because React passes classes around as arguments and we need to talk
about that.

### Elements

Elements are _instances_ of Components. If I say "x is a Component", then
`let y = new x()` will construct an Element. Elements contain a few important pieces:

- `domNode`: the actual DOM node that React has built for this element.
- `props`: the React properties that this Element currently has.
- `children: Array<Element>`: the children that this Element currently has.

These aren't _actual_ fields on the actual JS objects; I'm just going using them
to explain how React works.

Elements form React's _virtual DOM_.

### Lazy Elements

When you say `<MyComponent prop={value}>{children}</MyComponent>`, that
doesn't actually construct an Element. Instead, React is lazy and will only
later construct the Element if it's needed. I'm going to call these
`LazyElements`, and say that they have these pieces:

- `props`: the React properties this element was built with. In the above
example, `{prop: value, children: children}`.
- `Component`: the Component class this element was built with. In the above
example, `MyComponent`.

Again, I'm not sure how React _actually_ implements lazy elements, but I'll
assume they have these fields for expository purposes.

## Setup

What happens when new elements are created? In pseudocode:

```javascript
// Insert a new element into the DOM
function add(elem: LazyElement) {
  let newElem: Element = new elem.Component();
  let node, newChildren = newElem.render();
  insert node into the actual DOM; elem.domNode = node;
  for (let child of newChildren) { add(child); }
  node.didMount();
}
```

Thus, any particular Element sees this order of events:

1. Its constructor is called.
2. Its `render()` method is called.
3. React builds an actual DOM node based on the results of the `render()` call,
and inserts it into the actual DOM.
4. Its `componentDidMount()` method is called.

When you call `React.renderDOM(elem, domNode)`, that essentially calls
`add(elem)`.

## Teardown

Setup was pretty easy, and teardown is easy too. An element is deleted as
follows:

```javascript
// Remove an element from the DOM
function remove(elem: Element) {
  elem.componentWillUnmount();
  for (let child of elem.children) {
    remove(child);
  }
  remove elem.domNode from the actual DOM;
}
```

## Update

What happens when you update an element, say by calling `setState` or
`dispatch`, however, is more complicated:

```javascript
// Update the props or state of an existing element
function update(oldElem: Element, newElem: LazyElement, newState: State) {
  if oldElem.shouldComponentUpdate(newElem.props, newState) {
    let node, newChildren = oldElem.render();
    reconcile(oldElem.children, newChildren);
  }
}

// Reconcile the difference between the original set of children that an
// element had, and the new children it produced in a call to `render()`.
function reconcile(oldChildren: Array<Element>, newChildren: Array<LazyElement>) {
  for let (oldChild, newChild) of align(oldChildren, newChildren) {
    if (!newChild) { remove(oldChild) }
    if (!oldChild) { add(newChild) }
    else { update(oldChild, newChild, getState()) }
    // (I'm not sure about the order of these.)
  }
}

// Zip `oldChildren` and `newChildren` into a list of pairs,
// using `undefined` to mark when a child has no pairing.
function align(oldChildren, newChildren) {
  An old child and a new child align if:
    (i) They have the same `key` prop, and
    (ii) their components are `==`
  If no `key` props are given, use the children's array index as their `key`.
}
```

The `align` algorithm that React uses is a hack. While this isn't React's
fault---I think it's as good as it could be in an untyped language---it makes
things tricky in a couple of ways:

1. Whenever a component has a variable number of children, you should use the
   `key` prop. If you don't, React is bindly guessing when two things happen to
   be the same, based only on the order in which they appear, and what _class_
   they have.
2. Notice that if the old child's component is not `==` to the new child's component
   (that's reference equality), then `shouldComponentUpdate` will not be called.
   Therefore you need to be careful where you use "higher order components"
   (e.g., a function that takes a Component and returns an upgraded version of
   that Component), because every time the higher order component is called it
   will produce a distinct (not `==`) result.
