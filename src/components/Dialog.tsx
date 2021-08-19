import React, {Component, KeyboardEvent, ReactElement} from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import '../less/Dialog.less';

type Props = {
  appElement: string | HTMLElement;
  closeFn: () => void;
  isOpen: boolean;
  body: {
    title: ReactElement,
    content: ReactElement
  } | null;
  keyUp?: React.KeyboardEventHandler<HTMLDivElement>;
}

export default class Dialog extends Component<Props> {
  titleRef: React.Ref<unknown>;
  constructor(props:Props) {
    super(props);
    this.titleRef = React.createRef();
  }

  static propTypes = {
    appElement: PropTypes.object.isRequired,
    isOpen: PropTypes.bool.isRequired,
    closeFn: PropTypes.func.isRequired,
    keyUp: PropTypes.func,
    body: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]).isRequired
  }

  onKeyUp = (e:KeyboardEvent) => { if (e.key === 'Escape') this.props.closeFn() }

  componentDidMount() {
    Modal.setAppElement(this.props.appElement);
  }

  focusTitle() {
    document.getElementById('heading').focus();
  }
  
  render() {
    const {appElement, isOpen, closeFn, keyUp, body} = this.props;
    return (
      <Modal 
        isOpen={isOpen}
        className={"madeUpClassToCancelDefaultStyles"}
        onRequestClose={closeFn}
        shouldCloseOnEsc={true}
        shouldReturnFocusAfterClose={true}
        shouldFocusAfterRender={true}
        shouldCloseOnOverlayClick={true}
        onAfterOpen={this.focusTitle}
        aria={ {labelledby: "heading"} }>
        <div tabIndex={-1} id="DialogContents" onKeyUp={keyUp || this.onKeyUp}>
          <h1 tabIndex={-1} id="heading">{this.props.body?.title}</h1>
          {this.props.body?.content}
          <button className="closeDialog" onClick={() => this.props.closeFn()}>Close</button>
        </div>
      </Modal>
      );
  
  }
}