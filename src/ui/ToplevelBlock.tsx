import React from "react";
import ReactDOM from "react-dom";
import { poscmp, setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";
import type { afterDOMUpdateHandle } from "../utils";
import BlockComponent from "../components/BlockComponent";
import { ASTNode } from "../ast";
import { CMBEditor, BlockNodeMarker } from "../editor";

type Props = {
  incrementalRendering: boolean;
  node: ASTNode;
  editor: CMBEditor;
};

type State = {
  renderPlaceholder: boolean;
};

export default class ToplevelBlock extends BlockComponent<Props, State> {
  container: HTMLElement;
  mark?: BlockNodeMarker;
  pendingTimeout?: afterDOMUpdateHandle;

  constructor(props: Props) {
    super(props);
    this.container = document.createElement("span");
    this.container.classList.add("react-container");
    // by default, let's render a placeholder
    this.state = { renderPlaceholder: props.incrementalRendering };
  }

  // we need to trigger a render if the node was moved or resized at the
  // top-level, in order to re-mark the node and put the DOM in the new marker
  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return (
      poscmp(this.props.node.from, nextProps.node.from) !== 0 || // moved
      poscmp(this.props.node.to, nextProps.node.to) !== 0 || // resized
      super.shouldComponentUpdate(nextProps, nextState) || // changed
      !document.contains(this.mark?.replacedWith || null)
    ); // removed from DOM
  }

  // When unmounting, clean up the TextMarker and any lingering timeouts
  componentWillUnmount() {
    this.mark?.clear();
    cancelAfterDOMUpdate(this.pendingTimeout);
  }

  // once the placeholder has mounted, wait 250ms and render
  // save both the timeout *and* requestAnimationFrame (RAF)
  // in case someone unmounts before all the root components
  // have even rendered
  componentDidMount() {
    if (!this.props.incrementalRendering) {
      return; // bail if incremental is off
    }
    this.pendingTimeout = setAfterDOMUpdate(
      () => this.setState({ renderPlaceholder: false }),
      250
    );
  }

  render() {
    const { node } = this.props;

    // set elt to a cheap placeholder, OR render the entire rootNode
    const elt = this.state.renderPlaceholder ? <div /> : node.reactElement();

    // make a new block marker, and fill it with the portal
    const { from, to } = node.srcRange(); // includes the node's comment, if any
    this.mark = this.props.editor.replaceMarkerWidget(from, to, this.container);
    node.mark = this.mark;

    return ReactDOM.createPortal(elt, this.container);
  }
}
