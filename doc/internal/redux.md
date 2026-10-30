# Redux Notes

These are some general notes on the [Redux](https://redux.js.org/) library.
Mostly, they are a summary of the
[Redux tutorial](https://redux.js.org/introduction/motivation). If something
isn't clear here, that's a good place to look to try to get a deeper
understanding.

## Redux Overview

Why use Redux?

> _Redux attempts to make state mutations predictable_ by imposing certain
> restrictions on how and when updates can happen. These restrictions are
> reflected in the three principles of Redux.

Redux is more of a design pattern than a framework. The library simply provides
some utilities to make it easier to use this pattern.

The main idea of the Redux design pattern is to organize your state changes as a
set of global **actions**, which each have a `type` plus whatever additional
fields are needed. For example:

    { type: 'ADD_TODO', text: 'Go to swimming pool' }
    { type: 'TOGGLE_TODO', index: 1 }
    { type: 'SET_VISIBILITY_FILTER', filter: 'SHOW_ALL' }

Then you have a set of **reducers** that say how each action type updates the
state:

    reducer: state, action -> state

## Three Principles

In addition, Redux is about obeying three principles.

### Principle 1: Single Source of Truth

> The state of your whole application is stored in an object tree within a
> single store.

This is good for debugging: it's easier to reproduce something (like a bug) when
there's no hidden state.

We don't actually obey this principle in CMB right now: some of our React
components contain local state. We do obey the next two principles, though.

### Principle 2: State is Read-only

> The only way to change the state is to emit an action, an object describing
> what happened.

This prodives a nice, first-class, readable and storable log of everything that
happens in your application.

### Principle 3: Changes are made with Pure Functions

> To specify how the state tree is transformed by actions, you write pure
> reducers.

This is important for Redux to be able to correctly provide features like "time
travel, record/replay, or hot reloading".

## Redux in React

React is very protective of its state, so Redux needs special permission to be
able to connect to it. This is done via the
[connect](https://redux.js.org/basics/usage-with-react) function.

## Our use of Redux

We do not fully use Redux. A lot of CMB uses local state in React Components.
The place we _do_ use it is to easily pass state from an ancestor to some of its
descendants without having to pass it as a prop throughout the whole line of
succession, and to keep track of the AST, focus, selection, collapsed nodes and
the in-progress edit ("quarantine").

The store is created by `createAppStore()` in `src/state/store.ts`, with
`redux-thunk` and an activity logger as middleware. A few ground rules:

- **Reducers are pure.** The reducer in `src/state/reducers.ts` never mutates
  its state, and never touches the editor. Anything that needs the editor, such
  as undo and redo (which live in CodeMirror's history), is a thunk in
  `src/state/actions.ts`.
- **State is only changed by dispatching actions.** Code that reads state with
  `getState()` must not assign to it; the fields are `readonly`.
- **The log of actions is middleware.** `src/state/activityLog.ts` records the
  actions that reach the reducer (with ASTs replaced by their source code), so
  that sessions can be downloaded and replayed from the debugging page
  (`src/toolkit/debug.ts`). Actions should therefore stay serializable: don't
  put editors or other live objects in them. (`ADD_MARK` is the exception, since
  it stores a CodeMirror `TextMarker`.)
- **We don't use Redux Toolkit.** The state holds `Map`s (the AST indexes) and
  CodeMirror objects, which don't mix well with Immer's drafts or with the
  toolkit's serializability checks.
