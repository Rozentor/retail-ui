/* @flow */

import React, {PropTypes} from 'react';

import AddressModal from './AddressModal';
import Link from '../Link';
import type {Address} from './Types';
import * as util from './util';

type Props = {
  title: string,
  value: any,
  onChange: any,
};

type State = {
  opened: bool,
};

/**
 * DRAFT
 */
class Kladr extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    value: PropTypes.any,
    onChange: PropTypes.func,
  };

  props: Props;
  state: State;

  constructor(props: any) {
    super(props);

    this.state = {
      opened: false,
    };
  }

  render() {
    const value = this.props.value || {};
    const empty = isEmpty(value);
    const change = empty ? 'Заполнить адрес' : 'Изменить адрес';

    return (
      <span>
        {!empty && (
          <div style={{marginBottom: 5}}>
            {this._renderAddress(value.address)}
          </div>
        )}
        <Link icon="edit" onClick={this._handleOpen}>{change}</Link>
        {this.state.opened && this._renderModal()}
      </span>
    );
  }

  _renderAddress(address: ?Address) {
    if (!address) {
      return null;
    }

    const place = place => (place && util.placeName(place));
    return [
      address.index,
      place(address.region),
      place(address.district),
      place(address.city),
      place(address.settlement),
      place(address.street),
      address.house && `дом ${address.house}`,
      address.room && `квартира ${address.room}`,
    ].filter(x => !!x).join(', ');
  }

  _renderModal() {
    return (
      <AddressModal
        address={this.props.value && this.props.value.address}
        title={this.props.title}
        onChange={this._handleChange}
        onClose={this._handleClose}
      />
    );
  }


  _handleOpen = () => {
    this.setState({opened: true});
  };

  _handleChange = (value: {address: Address}) => {
    const onChange = this.props.onChange;
    onChange && onChange(null, value);
  };

  _handleClose = () => {
    this.setState({opened: false});
  };
}

function isEmpty(value) {
  const address = value.address;
  if (address) {
    for (const key of Object.keys(address)) {
      if (address[key]) {
        return false;
      }
    }
  }

  return true;
}

export default Kladr;
