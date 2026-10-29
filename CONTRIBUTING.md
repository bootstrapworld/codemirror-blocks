# Contributing to codemirror-blocks

If you'd like to discuss a change you want to make before spending
the time to write the code, please submit a new issue first and we
can discuss it there.

### Steps for submitting a pull request

1. Make sure you haven't broken anything by running `npm test`, `npm run lint`,
   `npm run typecheck` and `npm run format:check` from the repository root
   (see the README for details)
2. Write new unit tests for your change and make sure it covers
   your modified code by running `npm test -- --coverage` and looking
   at the output in `.coverage/lcov-report/index.html`
3. If you are adding a feature, make sure it is documented in the relevant `README.md` file (or in `doc/`).
4. Update the `CHANGELOG.md` file to reflect your change.
