/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @flow

import * as React from 'react';
import classNames from 'classnames';
// import TimelineSelection from './Selection';
import explicitConnect from '../../utils/connect';
import ActiveTabResourceTrack from './ActiveTabResourceTrack';
import { withSize } from '../shared/WithSize';
import { isActiveTabResourcesOpen } from '../../selectors/url-state';
import { toggleResourcesPanel } from '../../actions/app';

import './ActiveTabResources.css';

import type { SizeProps } from '../shared/WithSize';

import type { LocalTrack } from '../../types/profile-derived';
import type { ConnectedProps } from '../../utils/connect';

type OwnProps = {|
  +resourceTracks: LocalTrack[],
  +setIsInitialSelectedPane: (value: boolean) => void,
|};

type StateProps = {|
  isActiveTabResourcesOpen: boolean,
|};

type DispatchProps = {|
  +toggleResourcesPanel: typeof toggleResourcesPanel,
|};

type Props = {|
  ...SizeProps,
  ...ConnectedProps<OwnProps, StateProps, DispatchProps>,
|};

class Resources extends React.PureComponent<Props> {
  render() {
    const {
      resourceTracks,
      setIsInitialSelectedPane,
      toggleResourcesPanel,
      isActiveTabResourcesOpen,
    } = this.props;
    return (
      <div className="timelineResources">
        <div
          onClick={toggleResourcesPanel}
          className={classNames('timelineResourcesHeader', {
            opened: isActiveTabResourcesOpen,
          })}
        >
          Resources ({resourceTracks.length})
        </div>
        {isActiveTabResourcesOpen ? (
          <ol className="timelineResourceTracks">
            {resourceTracks.map((localTrack, trackIndex) => (
              <ActiveTabResourceTrack
                key={trackIndex}
                localTrack={localTrack}
                trackIndex={trackIndex}
                setIsInitialSelectedPane={setIsInitialSelectedPane}
              />
            ))}
          </ol>
        ) : null}
      </div>
    );
  }
}

export default explicitConnect<OwnProps, StateProps, DispatchProps>({
  mapStateToProps: state => ({
    isActiveTabResourcesOpen: isActiveTabResourcesOpen(state),
  }),
  mapDispatchToProps: { toggleResourcesPanel },
  component: withSize<Props>(Resources),
});
