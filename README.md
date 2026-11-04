[![Build Status](https://github.com/bootstrapworld/codemirror-blocks/actions/workflows/run-tests.yml/badge.svg)](https://github.com/bootstrapworld/codemirror-blocks/actions)
[![Coverage Status](https://coveralls.io/repos/bootstrapworld/codemirror-blocks/badge.svg?branch=master&service=github)](https://coveralls.io/github/bootstrapworld/codemirror-blocks?branch=master)

# codemirror-blocks

codemirror-blocks is a project to make programming languages editable using visual blocks.

## About this repository

This repository contains the code for all the packages maintained by the codemirror-blocks team, including the core codemirror-blocks library, and various language modules that implement block
editors for individual languages using the core library. Documentation for individual packages
can be found in their respective directories:

- [codemirror-blocks](packages/codemirror-blocks/) - the core library used to make block editors. Start here if you'd like to implement a new block editor for a programming language of your choice.
- [wescheme-blocks](packages/wescheme-blocks/) - a block editor for the wescheme programming language.

## Experiments

Ideas we have tried or are considering, with what we learned. None of these are in the released editor.

- [CodeMirror 6 + Lezer](doc/experiments/cm6-lezer-spike.md): a feasibility spike for rebuilding on CodeMirror 6. Conditional go; months of work and a major API break.
- [Plain mode](doc/experiments/plain-mode.md): structured editing that looks like plain text (issue #106). Looks viable; the obstacle is that block mode re-prints the program on every edit.
- [Profiling large documents](doc/experiments/profile-large-doc.md): where the time goes (React renders the whole tree on every edit), with a reusable [profiler](doc/experiments/profile-large-doc/README.md).

## Keyboard shortcuts

These work when a block has focus (press **Shift-Ctrl-/** in the editor to show
the same list in a dialog). On a Mac, **Cmd** takes the place of **Ctrl** for
undo, redo, the clipboard, search and "edit anything"; every other key is the
same on all platforms.

**Moving around**

| Key                              | Action                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| Down / Up                        | Next / previous visible block                                          |
| Home / End                       | First / last visible block                                             |
| Left                             | Collapse the block, or move to its parent if it is already collapsed   |
| Right                            | Expand the block, or move to its first child if it is already expanded |
| Shift-Left / Shift-Right         | Collapse / expand all blocks                                           |
| Shift-Alt-Left / Shift-Alt-Right | Collapse / expand the whole top-level expression you are in            |
| Shift-,                          | Jump to the top-level expression you are in                            |
| \\                               | Read the block's ancestors aloud                                       |
| Shift-\\                         | Read the block's children aloud                                        |
| Shift-Tab                        | Move focus to the toolbar                                              |

**Editing**

| Key                                           | Action                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Enter                                         | Edit a literal (the box opens with its text selected). On a block with children, collapses or expands it |
| Ctrl-Enter (Cmd-Enter)                        | Edit any block as text                                                                                   |
| Enter, while editing                          | Save the edit                                                                                            |
| Esc or Alt-Q, while editing                   | Cancel the edit                                                                                          |
| Ctrl-[ / Ctrl-]                               | Insert a new block before / after the focused block                                                      |
| Delete or Backspace                           | Delete the selected blocks                                                                               |
| Ctrl-Z / Ctrl-Y (Cmd-Z / Cmd-Y), Shift-Ctrl-Z | Undo / redo                                                                                              |

**Selecting and the clipboard**

| Key                                              | Action                                               |
| ------------------------------------------------ | ---------------------------------------------------- |
| Space                                            | Add the focused block to the selection, or remove it |
| Esc, Ctrl-Esc or Alt-Q                           | Clear the selection                                  |
| Ctrl-X / Ctrl-C / Ctrl-V (Cmd-X / Cmd-C / Cmd-V) | Cut, copy, paste                                     |
| Shift-Ctrl-V (Shift-Cmd-V)                       | Paste before the focused block, instead of after     |

**Search**

| Key                        | Action                      |
| -------------------------- | --------------------------- |
| Ctrl-F or F3 (Cmd-F or F3) | Open the search dialog      |
| PageDown / PageUp          | Next / previous match       |
| Ctrl-F3 / Shift-Ctrl-F3    | Next / previous search type |

The bindings are defined in
[`packages/codemirror-blocks/src/keymap.tsx`](packages/codemirror-blocks/src/keymap.tsx).

### Screen readers

The first time a program is shown as blocks, the editor says what is at its top
level, for example "At the top level, this program contains 10 function
definitions, 2 variable definitions, and 3 function applications." It is said once per
editor, not on every switch between modes.

Whether a block is expanded or collapsed is exposed as `aria-expanded` on its
tree item, and NVDA and JAWS announce a change in it on their own, so the editor
does not speak "expanded" or "collapsed" itself. VoiceOver does not reliably
announce it, and we have chosen not to add our own announcement for that
platform: it is a minority for our users, and a second announcement would
repeat what NVDA and JAWS already say. (We tried it and reverted it; see the
commit "feat(a11y): say collapsed or expanded" and its revert in the history if
this is worth revisiting.)

### What blocks are called

Each kind of node declares a human-readable `label` (and a `pluralLabel` when
adding an "s" is wrong) in its `nodeSpec`, for example "function definition".
It is what a screenreader reads for a block that has no `ariaLabel` of its own,
and what the program summary calls that kind of node. A language can give a
node its own `ariaLabel` (a string, or a function of the node, so it can use
`node.label`), and can call a core kind of node something else by passing
`label` in the node's options: WeScheme calls variable definitions "value
definitions", for instance.

## Contributing Changes

To contribute changes to any of the packages in this repository, you'll need to setup a development
environment.

### Dev Environment

To get your dev environment up and running, follow these steps.

1. Clone the repository onto your local machine

1. Use Node 24 or later (`.nvmrc` pins the version that CI uses: with [nvm](https://github.com/nvm-sh/nvm), run `nvm use`)

1. Install dependencies with `npm`

   ```
   npm install
   ```

   _Note:_ This repository uses [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces), so you'll need to use npm v8 or later.

1. build the library and generate type declarations

   ```
   npm run build --workspaces
   npm run build-types --workspaces --if-present
   ```

1. run tests to confirm everything is setup correctly. This will run all tests in all sub-packages

   ```
   npm run test
   ```

1. Before sending a change, also run the same checks that CI does, from the repository root:

   ```
   npm run lint          # ESLint (flat config in eslint.config.mjs)
   npm run typecheck     # TypeScript, in strict mode
   npm run format:check  # Prettier; use `npx prettier --write .` to fix
   ```

### Development Workflow

At any given time, you'll probably be working in only one of the repo's sub-packages. Each package
provides it's own set of npm scripts to help with the build/test process. You can either run these scripts from the repository root and specify which package you are working on with `--workspace=<package-name>` or you can run the scripts from that packages directory without the `--workspace` setting. The following assumes you are doing the latter.

CMB is written in typescript, with some language extensions (like jsx syntax) that are handled by babel. As such, before any code can actually be executed outside of the tests, it must be transpiled to javascript. The easiest way to do this during development is to run each of the following commands in their own terminal:

1. Continuously transpile code from the **`src/`** directory to the **`lib/`** directory with babel:

   ```
   npm run build-watch
   ```

1. Continuously run typechecks and generate type declaration files in `lib/` with typescript:

   ```
   npm run build-types-watch
   ```

1. With these two processes running, you can then start the development server in yet another terminal with:

   ```
   npm start
   ```

   then open http://localhost:8080 in your browser to see CMB running on a web page. This web page just executes the example javascript from `example/editor-example.js`, which imports the transpiled code from `lib/`, so keep `build-watch` running to see your changes. The page also exposes the editor's API as `window.cmb` for use from the browser console.

1. Finally, you can also run tests continuously whenever code is changed. This should always be
   done from the repository root to make sure you don't inadvertently break an API that another
   package is depending on.

   ```
   npm run test-watch
   ```

**Coverage reports** can be generated by passing the `--coverage` flag to the test command:

```
npm test -- --coverage
```

The reports will be written to the `.coverage/` directory.
