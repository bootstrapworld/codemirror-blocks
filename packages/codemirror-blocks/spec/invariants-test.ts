import wescheme from "../src/languages/wescheme";
import { act } from "@testing-library/react";
import { AST } from "../src/ast";
import * as actions from "../src/state/actions";
import { mountCMB, teardown } from "../src/toolkit/test-utils";
import { skipInvariants } from "./globalSetup";
import { findInvariantViolations } from "./helpers/invariants";

// These tests check the checker: each one breaks the editor on purpose.
afterEach(teardown);

it("finds nothing wrong with a freshly loaded editor", () => {
  const { cmb } = mountCMB(wescheme);
  cmb.setValue("(+ 1 2) 99\n;a comment\n(* 3 4)");
  expect(findInvariantViolations()).toEqual([]);
});

it("finds nothing wrong with an empty editor", () => {
  mountCMB(wescheme);
  expect(findInvariantViolations()).toEqual([]);
});

it("notices when the AST no longer matches the text", () => {
  skipInvariants();
  const { cmb, store } = mountCMB(wescheme);
  cmb.setValue("(+ 1 2) 99");
  const other = AST.from("wescheme", wescheme.parse("(- 5 6)"));
  act(() => {
    store.dispatch(actions.setAST(other));
  });
  const violations = findInvariantViolations();
  expect(violations.join("\n")).toMatch(/out of sync with the text/);
});

it("notices a selection that points at a deleted node", () => {
  skipInvariants();
  const { cmb, store } = mountCMB(wescheme);
  cmb.setValue("(+ 1 2) 99");
  act(() => {
    store.dispatch(actions.setSelectedNodeIds(["no-such-node"]));
  });
  expect(findInvariantViolations().join("\n")).toMatch(
    /selected node no-such-node/
  );
});

it("notices keyboard focus stranded on the screenreader placeholder", () => {
  skipInvariants();
  const { cmb } = mountCMB(wescheme);
  cmb.setValue("(+ 1 2) 99");
  const placeholder = document.createElement("a");
  placeholder.id = "SR_fix_for_slow_dom";
  placeholder.href = "#";
  document.body.appendChild(placeholder);
  placeholder.focus();
  expect(findInvariantViolations().join("\n")).toMatch(/stranded/);
  placeholder.remove();
});
