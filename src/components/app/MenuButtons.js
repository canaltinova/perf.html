/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @flow

import * as React from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import explicitConnect from '../../utils/connect';
import classNames from 'classnames';
import {
  getProfile,
  getProfileRootRange,
  getProfileSharingStatus,
  getSymbolicationStatus,
  getGlobalTracks,
  getCommittedRange,
} from '../../selectors/profile';
import {
  getDataSource,
  getUrlPredictor,
  getHiddenGlobalTracks,
} from '../../selectors/url-state';
import actions from '../../actions';
import { compress } from '../../utils/gz';
import { uploadBinaryProfileData } from '../../profile-logic/profile-store';
import ArrowPanel from '../shared/ArrowPanel';
import ButtonWithPanel from '../shared/ButtonWithPanel';
import shortenUrl from '../../utils/shorten-url';
import {
  serializeProfile,
  sanitizePII,
} from '../../profile-logic/process-profile';
import prettyBytes from '../../utils/pretty-bytes';
import sha1 from '../../utils/sha1';
import { sendAnalytics } from '../../utils/analytics';
import url from 'url';

import type { StartEndRange } from '../../types/units';
import type { Profile, ProfileMeta } from '../../types/profile';
import type {
  TrackIndex,
  GlobalTrack,
  RemoveProfileInformation,
} from '../../types/profile-derived';
import type { Action, DataSource } from '../../types/actions';
import type {
  ProfileSharingStatus,
  SymbolicationStatus,
} from '../../types/state';
import type {
  ExplicitConnectOptions,
  ConnectedProps,
} from '../../utils/connect';

require('./MenuButtons.css');

const UploadingStatus = ({ progress }: { progress: number }) => (
  <div className="menuButtonsUploadingButton">
    <div className="menuButtonsUploadingButtonInner">
      <progress
        className="menuButtonsUploadingButtonProgress"
        value={progress}
      />
      <div className="menuButtonsUploadingButtonLabel">Uploading...</div>
    </div>
  </div>
);

type ProfileSharingButtonProps = {|
  +buttonClassName: string,
  +shareLabel: string,
  +symbolicationStatus: string,
  +okButtonClickEvent: () => mixed,
  +panelOpenEvent?: () => void,
  +PIIListToBeRemoved: Set<string>,
  +PIICheckboxesOnChange?: (SyntheticEvent<HTMLInputElement>) => void,
  // +checkboxDisabled: boolean,
|};

const ProfileSharingButton = ({
  buttonClassName,
  shareLabel,
  symbolicationStatus,
  okButtonClickEvent,
  panelOpenEvent,
  PIIListToBeRemoved,
  PIICheckboxesOnChange,
}: ProfileSharingButtonProps) => (
  <ButtonWithPanel
    className={buttonClassName}
    label={shareLabel}
    disabled={symbolicationStatus !== 'DONE'}
    panel={
      <ArrowPanel
        className="menuButtonsPrivacyPanel"
        // title="Upload Profile – Privacy Notice"
        // okButtonText="Share"
        // cancelButtonText="Cancel"
        // onOkButtonClick={okButtonClickEvent}
        onOpen={panelOpenEvent ? panelOpenEvent : undefined}
      >
        <div className="menuButtonsPrivacyContent">
          <div className="menuButtonsPrivacyIcon" />
          <p className="menuButtonsPrivacyInfoDescription">
            You’re about to share your profile potentially where others have
            public access to it. By default, the profile is stripped of much of
            the personally identifiable information.
          </p>
          <details className="menuButtonsPrivacyData">
            <summary className="menuButtonsPrivacyDataSummary">
              Select more data to include
            </summary>
            <label className="menuButtonsPrivacyDataLabel menuButtonsPrivacyDataLabelAll">
              <input
                className="menuButtonsPrivacyDataLabelAllInput"
                type="checkbox"
                value="all"
              />
              Include all information
            </label>
            <div className="menuButtonsPrivacyDataColumns">
              <div className="menuButtonsPrivacyDataColumn">
                <label className="menuButtonsPrivacyDataLabel">
                  <input
                    type="checkbox"
                    checked={!PIIListToBeRemoved.has('hiddenThreads')}
                    // eslint-disable-next-line react/jsx-no-bind
                    onChange={event =>
                      PIICheckboxesOnChange(event, 'hiddenThreads')
                    }
                  />
                  Include hidden threads
                </label>
                <label className="menuButtonsPrivacyDataLabel">
                  <input
                    type="checkbox"
                    checked={!PIIListToBeRemoved.has('timeRange')}
                    // eslint-disable-next-line react/jsx-no-bind
                    onChange={event =>
                      PIICheckboxesOnChange(event, 'timeRange')
                    }
                  />
                  Include full time range
                </label>
                <label className="menuButtonsPrivacyDataLabel">
                  <input
                    type="checkbox"
                    checked={!PIIListToBeRemoved.has('screenshots')}
                    // eslint-disable-next-line react/jsx-no-bind
                    onChange={event =>
                      PIICheckboxesOnChange(event, 'screenshots')
                    }
                  />
                  Include screenshots
                </label>
              </div>
              <div className="menuButtonsPrivacyDataColumn">
                <label className="menuButtonsPrivacyDataLabel">
                  <input
                    type="checkbox"
                    checked={!PIIListToBeRemoved.has('networkUrls')}
                    // eslint-disable-next-line react/jsx-no-bind
                    onChange={event =>
                      PIICheckboxesOnChange(event, 'networkUrls')
                    }
                  />
                  Include network traffic URLs
                </label>
                <label className="menuButtonsPrivacyDataLabel">
                  <input
                    type="checkbox"
                    checked={!PIIListToBeRemoved.has('allUrls')}
                    // eslint-disable-next-line react/jsx-no-bind
                    onChange={event => PIICheckboxesOnChange(event, 'allUrls')}
                  />
                  Include All profile URLs
                </label>
                <label className="menuButtonsPrivacyDataLabel">
                  <input
                    type="checkbox"
                    checked={!PIIListToBeRemoved.has('extensions')}
                    // eslint-disable-next-line react/jsx-no-bind
                    onChange={event =>
                      PIICheckboxesOnChange(event, 'extensions')
                    }
                  />
                  Include Extensions
                </label>
              </div>
            </div>
          </details>
          <div className="menuButtonsPrivacyButtons">
            <div
              aria-role="button"
              className="menuButtonsPrivacyButton menuButtonsPrivacyButtonsUpload"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => okButtonClickEvent()}
            >
              <span className="menuButtonsPrivacyButtonsSvg menuButtonsPrivacyButtonsSvgUpload" />
              Upload
            </div>
            <div
              aria-role="button"
              className="menuButtonsPrivacyButton menuButtonsPrivacyButtonsDownload"
            >
              <span className="menuButtonsPrivacyButtonsSvg menuButtonsPrivacyButtonsSvgDownload" />
              Download
            </div>
            <div
              aria-role="button"
              className="menuButtonsPrivacyButton menuButtonsPrivacyButtonsCancel"
            >
              <span className="menuButtonsPrivacyButtonsSvg menuButtonsPrivacyButtonsSvgCancel" />
              Cancel
            </div>
          </div>
        </div>
      </ArrowPanel>
    }
  />
);

type ProfileMetaInfoButtonProps = {
  profile: Profile,
};

type ProfileSharingCompositeButtonProps = {
  profile: Profile,
  dataSource: DataSource,
  symbolicationStatus: SymbolicationStatus,
  predictUrl: (Action | Action[]) => string,
  onProfilePublished: typeof actions.profilePublished,
  profileSharingStatus: ProfileSharingStatus,
  setProfileSharingStatus: typeof actions.setProfileSharingStatus,
  globalTracks: GlobalTrack[],
  hiddenGlobalTracks: Set<TrackIndex>,
  timeRange: StartEndRange,
};

type ProfileSharingCompositeButtonState = {
  state: string,
  uploadProgress: number,
  error: Error | null,
  fullUrl: string,
  shortUrl: string,
  PIIListToBeRemoved: Set<string>,
};

function _mapMetaInfoExtensionNames(data: string[]): React.DOM {
  const extensionList = data.map(d => (
    <li className="metaInfoListItem" key={d}>
      {d}
    </li>
  ));
  return extensionList;
}

function _formatDate(timestamp: number): string {
  const timestampDate = new Date(timestamp).toUTCString();
  return timestampDate;
}

function _formatVersionNumber(version?: string): string | null {
  const regex = /[0-9]+.+[0-9]/gi;

  if (version) {
    const match = version.match(regex);
    if (match) {
      return match.toString();
    }
  }
  return null;
}

function _formatLabel(meta: ProfileMeta): string | null {
  const product = meta.product || '';
  const version = _formatVersionNumber(meta.misc) || '';
  const os = meta.oscpu || '';

  const labelTitle = product + ' (' + version + ') ' + os;

  if (labelTitle.length < 5) {
    return null;
  }
  return labelTitle;
}

class ProfileMetaInfoButton extends React.PureComponent<
  ProfileMetaInfoButtonProps
> {
  render() {
    const { profile } = this.props;
    const meta = profile.meta;

    if (meta !== undefined && meta !== null) {
      return (
        <div className="menuButtonsOpenMetaInfoButtonBox">
          <div className="menuButtonsOpenMetaInfoButtonLabel">
            <span className="menuButtonsOpenMetaInfoButtonLabelOverflow">
              {_formatLabel(meta)}
            </span>
          </div>
          <ButtonWithPanel
            className="menuButtonsOpenMetaInfoButtonButton"
            label="&nbsp;"
            panel={
              <ArrowPanel className="arrowPanelOpenMetaInfo">
                <h2 className="arrowPanelSubTitle">Timing</h2>
                <div className="arrowPanelSection">
                  {meta.startTime ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Recording started:</span>
                      {_formatDate(meta.startTime)}
                    </div>
                  ) : null}
                  {meta.interval ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Interval:</span>
                      {meta.interval}ms
                    </div>
                  ) : null}
                  {meta.preprocessedProfileVersion ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Profile Version:</span>
                      {meta.preprocessedProfileVersion}
                    </div>
                  ) : null}
                </div>
                <h2 className="arrowPanelSubTitle">Application</h2>
                <div className="arrowPanelSection">
                  {meta.product ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Name:</span>
                      {meta.product}
                    </div>
                  ) : null}
                  {meta.misc ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Version:</span>
                      {_formatVersionNumber(meta.misc)}
                    </div>
                  ) : null}
                  {meta.appBuildID ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Build ID:</span>
                      {meta.sourceURL ? (
                        <a
                          href={meta.sourceURL}
                          title={meta.sourceURL}
                          target="_blank"
                        >
                          {meta.appBuildID}
                        </a>
                      ) : (
                        meta.appBuildID
                      )}
                    </div>
                  ) : null}
                  {meta.extensions ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Extensions:</span>
                      <ul className="metaInfoList">
                        {_mapMetaInfoExtensionNames(meta.extensions.name)}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <h2 className="arrowPanelSubTitle">Platform</h2>
                <div className="arrowPanelSection">
                  {meta.platform ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">Platform:</span>
                      {meta.platform}
                    </div>
                  ) : null}
                  {meta.oscpu ? (
                    <div className="metaInfoRow">
                      <span className="metaInfoLabel">OS:</span>
                      {meta.oscpu}
                    </div>
                  ) : null}
                </div>
              </ArrowPanel>
            }
          />
        </div>
      );
    }
    return null;
  }
}
// CSSTransition wrapper component
const AnimateUpTransition = (props: {}) => (
  <CSSTransition
    {...props}
    timeout={200}
    classNames="menuButtonsTransitionUp"
  />
);

class ProfileSharingCompositeButton extends React.PureComponent<
  ProfileSharingCompositeButtonProps,
  ProfileSharingCompositeButtonState
> {
  _permalinkButton: ButtonWithPanel | null;
  _permalinkTextField: HTMLInputElement | null;
  _takePermalinkButtonRef = elem => {
    this._permalinkButton = elem;
  };
  _takePermalinkTextFieldRef = elem => {
    this._permalinkTextField = elem;
  };
  _attemptToSecondaryShare = () => this._attemptToShare(true);

  constructor(props: ProfileSharingCompositeButtonProps) {
    super(props);
    const { dataSource } = props;
    this.state = {
      state: dataSource === 'public' ? 'public' : 'local', // local -> uploading (<-> error) -> public
      uploadProgress: 0,
      error: null,
      fullUrl: window.location.href,
      shortUrl: window.location.href,
      PIIListToBeRemoved: new Set(),
    };
  }

  componentWillReceiveProps({
    dataSource,
  }: ProfileSharingCompositeButtonProps) {
    if (dataSource === 'public' && this.state.state !== 'public') {
      this.setState({ state: 'public' });
    }
    if (window.location.href !== this.state.fullUrl) {
      this.setState({
        fullUrl: window.location.href,
        shortUrl: window.location.href,
      });
    }
  }

  _onPermalinkPanelOpen = () => {
    this._shortenUrlAndFocusTextFieldOnCompletion();
  };

  _shortenUrlAndFocusTextFieldOnCompletion(fullUrl?: string): Promise<void> {
    fullUrl = fullUrl || this.state.fullUrl;
    return shortenUrl(fullUrl)
      .then(shortUrl => {
        this.setState({ shortUrl });
        const textField = this._permalinkTextField;
        if (textField) {
          textField.focus();
          textField.select();
        }
      })
      .catch(() => {});
  }

  _onPermalinkPanelClose = () => {
    if (this._permalinkTextField) {
      this._permalinkTextField.blur();
    }
  };

  _notifyAnalytics() {
    sendAnalytics({
      hitType: 'event',
      eventCategory: 'profile upload',
      eventAction: 'start',
    });
  }

  /**
   * This function starts the profile sharing process.
   * Takes an optional argument that indicates if the share attempt
   * is being made for the second time. We have two share buttons,
   * one for sharing for the first time, and one for sharing
   * after the initial share depending on the previous URL share status.
   * People can decide to remove the URLs from the profile after sharing
   * with URLs or they can decide to add the URLs after sharing without
   * them. We check the current state before attempting to share depending
   * on that flag.
   */
  _attemptToShare = async (isSecondaryShare: boolean = false) => {
    if (
      ((!isSecondaryShare && this.state.state !== 'local') ||
        (isSecondaryShare && this.state.state !== 'public')) &&
      this.state.state !== 'error'
    ) {
      return;
    }
    this._notifyAnalytics();

    const {
      profile,
      predictUrl,
      profileSharingStatus,
      hiddenGlobalTracks,
      globalTracks,
    } = this.props;

    try {
      if (!profile) {
        throw new Error('profile is null');
      }

      const globalHiddenThreads = [];
      const hiddenScreenshots = [];
      for (let i = 0; i < globalTracks.length; i++) {
        if (hiddenGlobalTracks.has(i)) {
          const track = globalTracks[i];
          if (track.type === 'process') {
            if (track.mainThreadIndex !== null) {
              globalHiddenThreads.push(track.mainThreadIndex);
            }
          } else if (track.type === 'screenshots') {
            hiddenScreenshots.push(track.threadIndex);
          } else {
            throw new Error(
              'There is no other track type currently. Please update this code if new one is added.'
            );
          }
        }
      }

      const piiList = this.state.PIIListToBeRemoved;
      const piiToBeRemoved: RemoveProfileInformation = {
        shouldRemoveThreads: piiList.has('hiddenThreads')
          ? globalHiddenThreads
          : [],
        shouldRemoveThreadsWithScreenshots: piiList.has('screenshots')
          ? (globalTracks.filter(
              track => track.type === 'screenshots'
            ): any).map(track => track.threadIndex)
          : piiList.has('hiddenThreads') ? hiddenScreenshots : [],
        shouldRemoveNetworkUrls: piiList.has('networkUrls'),
        shouldRemoveAllUrls: piiList.has('allUrls'),
        shouldFilterToCommittedRange: piiList.has('timeRange')
          ? this.props.timeRange
          : null,
        shouldRemoveExtensions: piiList.has('extensions'),
      };
      const sanitizedProfile = sanitizePII(profile, piiToBeRemoved);
      const jsonString = serializeProfile(sanitizedProfile);
      if (!jsonString) {
        throw new Error('profile serialization failed');
      }

      const newProfileSharingStatus = {
        sharedWithUrls:
          this.state.shareNetworkUrls || profileSharingStatus.sharedWithUrls,
        sharedWithoutUrls:
          !this.state.shareNetworkUrls ||
          profileSharingStatus.sharedWithoutUrls,
      };
      this.props.setProfileSharingStatus(newProfileSharingStatus);
      this.setState({ state: 'uploading', uploadProgress: 0 });

      const typedArray = new TextEncoder().encode(jsonString);

      const [gzipData, hash]: [Uint8Array, string] = await Promise.all([
        compress(typedArray.slice(0)),
        sha1(typedArray),
      ]);

      // If we removed something that will affect url, we should update the
      // URL respectfully and update the permalink input.
      const actionList = [actions.profilePublished(hash)];
      if (
        piiToBeRemoved.shouldRemoveThreads !== null ||
        piiToBeRemoved.shouldRemoveThreadsWithScreenshots !== false
      ) {
        actionList.push(actions.hiddenTracksRemoved(hiddenGlobalTracks));
      }
      if (piiToBeRemoved.shouldFilterToCommittedRange !== null) {
        actionList.push(actions.fullTimeRangeRemoved());
      }

      const predictedUrl = url.resolve(
        window.location.href,
        predictUrl(actionList)
      );

      this.setState({
        fullUrl: predictedUrl,
        shortUrl: predictedUrl,
      });

      const uploadPromise = uploadBinaryProfileData(
        gzipData,
        uploadProgress => {
          this.setState({ uploadProgress });
        }
      ).then((hash: string) => {
        // const { onProfilePublished } = this.props;
        // onProfilePublished(hash);

        // this.setState(prevState => {
        //   const newShortUrl =
        //     prevState.fullUrl === window.location.href
        //       ? prevState.shortUrl
        //       : window.location.href;

        //   return {
        //     state: 'public',
        //     fullUrl: window.location.href,
        //     shortUrl: newShortUrl,
        //   };
        // });

        if (this._permalinkButton) {
          this._permalinkButton.openPanel();
        }

        sendAnalytics({
          hitType: 'event',
          eventCategory: 'profile upload',
          eventAction: 'succeeded',
        });
      });

      await Promise.all([
        uploadPromise,
        this._shortenUrlAndFocusTextFieldOnCompletion(),
      ]);
    } catch (error) {
      // To avoid any interaction with running transitions, we delay setting
      // the new state by 300ms.
      setTimeout(() => {
        this.setState({
          state: 'error',
          error,
        });
      }, 300);
      sendAnalytics({
        hitType: 'event',
        eventCategory: 'profile upload',
        eventAction: 'failed',
      });
    }
  };

  _onChangePIICheckbox = (
    event: SyntheticEvent<HTMLInputElement>,
    piiField: string
  ) => {
    this.setState((prevState, _props) => {
      const newSet = new Set(prevState.PIIListToBeRemoved);
      if (newSet.has(piiField)) {
        newSet.delete(piiField);
      } else {
        newSet.add(piiField);
      }
      return { PIIListToBeRemoved: newSet };
    });
  };

  _onSecondarySharePanelOpen = () => {
    const { profileSharingStatus } = this.props;
    // In the secondary sharing panel, we disable the URL sharing checkbox and
    // force it to the value we haven't used yet.
    // Note that we can't have both sharedWithUrls and sharedWithoutUrls set to
    // true here because we don't show the secondary panel when that's the case.
    this.setState({
      shareNetworkUrls: !profileSharingStatus.sharedWithUrls,
    });
  };

  render() {
    const { state, uploadProgress, error, shortUrl } = this.state;
    const { profile, symbolicationStatus, profileSharingStatus } = this.props;

    const shareLabel =
      symbolicationStatus === 'DONE'
        ? 'Share...'
        : 'Sharing will be enabled once symbolication is complete';

    // We don't show the secondary button if any of these conditions is true:
    // 1. If we loaded a profile from a file or the public store that got its network URLs removed before.
    //    Note that profiles captured from the add-on have this property set to false.
    // 2. If it's been shared in both modes already; in that case we show no button at all.
    const disableSecondaryShareProfile =
      profile.meta.networkURLsRemoved ||
      (profileSharingStatus.sharedWithUrls &&
        profileSharingStatus.sharedWithoutUrls);

    // Additionally we show it only when the profile is already shared
    // (either loaded from a public store or previously shared), because otherwise
    // we show the primary button (or errors).
    const isSecondaryShareButtonVisible =
      state === 'public' && !disableSecondaryShareProfile;

    const secondaryShareLabel = profileSharingStatus.sharedWithUrls
      ? 'Share without URLs'
      : 'Share with URLs';

    return (
      <TransitionGroup
        className={classNames('menuButtonsCompositeButtonContainer', {
          currentButtonIsShareButton: state === 'local',
          currentButtonIsUploadingButton: state === 'uploading',
          currentButtonIsPermalinkButton: state === 'public',
          currentButtonIsUploadErrorButton: state === 'error',
          currentButtonIsSecondaryShareButton: isSecondaryShareButtonVisible,
        })}
        data-testid="menuButtonsCompositeButtonContainer"
      >
        {/* the buttons are conditionally rendered (depending on the state) */}
        {state === 'local' && (
          <AnimateUpTransition>
            <ProfileSharingButton
              buttonClassName="menuButtonsShareButton"
              shareLabel={shareLabel}
              symbolicationStatus={symbolicationStatus}
              okButtonClickEvent={this._attemptToShare}
              PIIListToBeRemoved={this.state.PIIListToBeRemoved}
              PIICheckboxesOnChange={this._onChangePIICheckbox}
              // checkboxDisabled={false}
            />
          </AnimateUpTransition>
        )}

        {state === 'uploading' && (
          <AnimateUpTransition>
            <UploadingStatus progress={uploadProgress} />
          </AnimateUpTransition>
        )}

        {/* The Permalink button is rendered when state === 'uploading' AND state === 'public'.
       The Permalink button itself is hidden when uploading is in progress,
       but the Permalink's ArrowPanel with the URL is always displayed. */}
        {(state === 'uploading' || state === 'public') && (
          <AnimateUpTransition>
            <ButtonWithPanel
              className="menuButtonsPermalinkButton"
              ref={this._takePermalinkButtonRef}
              label="Permalink"
              panel={
                <ArrowPanel
                  className="menuButtonsPermalinkPanel"
                  onOpen={this._onPermalinkPanelOpen}
                  onClose={this._onPermalinkPanelClose}
                >
                  <input
                    type="text"
                    className="menuButtonsPermalinkTextField photon-input"
                    value={shortUrl}
                    readOnly="readOnly"
                    ref={this._takePermalinkTextFieldRef}
                  />
                </ArrowPanel>
              }
            />
          </AnimateUpTransition>
        )}

        {state === 'error' && (
          <AnimateUpTransition>
            <ButtonWithPanel
              className="menuButtonsUploadErrorButton"
              label="Upload Error"
              open
              panel={
                <ArrowPanel
                  className="menuButtonsUploadErrorPanel"
                  title="Upload Error"
                  okButtonText="Try Again"
                  cancelButtonText="Cancel"
                  onOkButtonClick={this._attemptToShare}
                >
                  <p>An error occurred during upload:</p>
                  <pre>{error && error.toString()}</pre>
                </ArrowPanel>
              }
            />
          </AnimateUpTransition>
        )}

        {isSecondaryShareButtonVisible && (
          <AnimateUpTransition>
            <ProfileSharingButton
              buttonClassName="menuButtonsSecondaryShareButton"
              shareLabel={secondaryShareLabel}
              symbolicationStatus={symbolicationStatus}
              okButtonClickEvent={this._attemptToSecondaryShare}
              panelOpenEvent={this._onSecondarySharePanelOpen}
              PIIListToBeRemoved={this.state.PIIListToBeRemoved}
              // checkboxDisabled={true}
            />
          </AnimateUpTransition>
        )}
      </TransitionGroup>
    );
  }
}

function filenameDateString(d: Date): string {
  const pad = x => (x < 10 ? `0${x}` : `${x}`);
  return `${pad(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

type ProfileDownloadButtonProps = {
  profile: Profile,
  rootRange: StartEndRange,
};

type ProfileDownloadButtonState = {|
  uncompressedBlobUrl: string,
  compressedBlobUrl: string,
  uncompressedSize: number,
  compressedSize: number,
  filename: string,
|};

class ProfileDownloadButton extends React.PureComponent<
  ProfileDownloadButtonProps,
  ProfileDownloadButtonState
> {
  state = {
    uncompressedBlobUrl: '',
    compressedBlobUrl: '',
    uncompressedSize: 0,
    compressedSize: 0,
    filename: '',
  };

  _onPanelOpen = () => {
    const { profile, rootRange } = this.props;
    const profileDate = new Date(profile.meta.startTime + rootRange.start);
    const serializedProfile = serializeProfile(profile);
    const blob = new Blob([serializedProfile], {
      type: 'application/octet-binary',
    });
    const blobUrl = URL.createObjectURL(blob);
    this.setState({
      filename: `${profile.meta.product} ${filenameDateString(
        profileDate
      )} profile.sps.json`,
      uncompressedBlobUrl: blobUrl,
      uncompressedSize: blob.size,
    });
    compress(serializedProfile).then(data => {
      const blob = new Blob([data], { type: 'application/octet-binary' });
      const blobUrl = URL.createObjectURL(blob);
      this.setState({
        compressedBlobUrl: blobUrl,
        compressedSize: blob.size,
      });
    });
    sendAnalytics({
      hitType: 'event',
      eventCategory: 'profile save locally',
      eventAction: 'save',
    });
  };

  render() {
    const {
      filename,
      uncompressedBlobUrl,
      compressedBlobUrl,
      uncompressedSize,
      compressedSize,
    } = this.state;
    return (
      <ButtonWithPanel
        className="menuButtonsProfileDownloadButton"
        label="Save as file…"
        panel={
          <ArrowPanel
            className="menuButtonsProfileDownloadPanel"
            title="Save Profile to a Local File"
            onOpen={this._onPanelOpen}
          >
            <section>
              {uncompressedBlobUrl ? (
                <p>
                  <a
                    className="menuButtonsDownloadLink"
                    href={uncompressedBlobUrl}
                    download={filename}
                  >
                    {`${filename} (${prettyBytes(uncompressedSize)})`}
                  </a>
                </p>
              ) : null}
              {compressedBlobUrl ? (
                <p>
                  <a
                    className="menuButtonsDownloadLink"
                    href={compressedBlobUrl}
                    download={`${filename}.gz`}
                  >
                    {`${filename}.gz (${prettyBytes(compressedSize)})`}
                  </a>
                </p>
              ) : null}
            </section>
          </ArrowPanel>
        }
      />
    );
  }
}

type MenuButtonsStateProps = {|
  +profile: Profile,
  +rootRange: StartEndRange,
  +dataSource: DataSource,
  +symbolicationStatus: SymbolicationStatus,
  +profileSharingStatus: ProfileSharingStatus,
  +predictUrl: (Action | Action[]) => string,
  +globalTracks: GlobalTrack[],
  +hiddenGlobalTracks: Set<TrackIndex>,
  +timeRange: StartEndRange,
|};

type MenuButtonsDispatchProps = {|
  +profilePublished: typeof actions.profilePublished,
  +setProfileSharingStatus: typeof actions.setProfileSharingStatus,
|};

type MenuButtonsProps = ConnectedProps<
  {||},
  MenuButtonsStateProps,
  MenuButtonsDispatchProps
>;

const MenuButtons = ({
  profile,
  rootRange,
  dataSource,
  symbolicationStatus,
  profilePublished,
  profileSharingStatus,
  setProfileSharingStatus,
  predictUrl,
  globalTracks,
  hiddenGlobalTracks,
  timeRange,
}: MenuButtonsProps) => (
  <>
    {/* Place the info button outside of the menu buttons to allow it to shrink. */}
    <ProfileMetaInfoButton profile={profile} />
    <div className="menuButtons">
      <ProfileSharingCompositeButton
        profile={profile}
        dataSource={dataSource}
        symbolicationStatus={symbolicationStatus}
        onProfilePublished={profilePublished}
        profileSharingStatus={profileSharingStatus}
        setProfileSharingStatus={setProfileSharingStatus}
        predictUrl={predictUrl}
        globalTracks={globalTracks}
        hiddenGlobalTracks={hiddenGlobalTracks}
        timeRange={timeRange}
      />
      <ProfileDownloadButton profile={profile} rootRange={rootRange} />
      <a
        href="/docs/"
        target="_blank"
        className="menuButtonsLink"
        title="Open the documentation in a new window"
      >
        Docs…
      </a>
    </div>
  </>
);

const options: ExplicitConnectOptions<
  {||},
  MenuButtonsStateProps,
  MenuButtonsDispatchProps
> = {
  mapStateToProps: state => ({
    profile: getProfile(state),
    rootRange: getProfileRootRange(state),
    dataSource: getDataSource(state),
    symbolicationStatus: getSymbolicationStatus(state),
    profileSharingStatus: getProfileSharingStatus(state),
    predictUrl: getUrlPredictor(state),
    globalTracks: getGlobalTracks(state),
    hiddenGlobalTracks: getHiddenGlobalTracks(state),
    timeRange: getCommittedRange(state),
  }),
  mapDispatchToProps: {
    profilePublished: actions.profilePublished,
    setProfileSharingStatus: actions.setProfileSharingStatus,
  },
  component: MenuButtons,
};
export default explicitConnect(options);
