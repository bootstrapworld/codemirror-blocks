import React, {Component} from 'react';
import SHARED from '../shared';
import {connect} from 'react-redux';
import {pos} from '../types';

class FakeCursorManager extends Component {
  static propTypes = {
    cur: pos,
  }
  render() {
    if (SHARED.cm && this.props.cur) {
      SHARED.cm.focus();
      SHARED.search.setCursor(this.props.cur);
      SHARED.cm.setCursor(this.props.cur);
    }
    return null;
  }
}

const mapStateToProps = ({cur}) => ({cur});
export default connect(mapStateToProps)(FakeCursorManager);
