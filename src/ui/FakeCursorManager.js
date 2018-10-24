import React, {Component} from 'react';
import global from '../global';
import {connect} from 'react-redux';
import {pos} from '../types';

class FakeCursorManager extends Component {
  static propTypes = {
    cur: pos,
  }
  render() {
    if (global.cm && this.props.cur) {
      global.cm.focus();
      global.cm.setCursor(this.props.cur);
    }
    return null;
  }
}

const mapStateToProps = ({cur}) => ({cur});
export default connect(mapStateToProps)(FakeCursorManager);
