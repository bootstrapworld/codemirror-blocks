import { useSelector } from "react-redux";
import type { AST } from "./ast";
import * as selectors from "./state/selectors";

/**
 * The program being edited, as the editor has it now (read only). A component
 * that calls it is drawn again when the program changes. Use it in a component
 * drawn inside a `<Node>`, as with {@link useNodeState}: it is how a block can
 * know what is around it (the names defined before it, say).
 */
export const useAST = (): AST => useSelector(selectors.getAST);
