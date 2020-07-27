/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @flow

import * as React from 'react';
import { Provider } from 'react-redux';
import { render, fireEvent } from '@testing-library/react';

import { TrackEventDelay } from '../../components/timeline/TrackEventDelay';
import { ensureExists } from '../../utils/flow';
import mockCanvasContext from '../fixtures/mocks/canvas-context';
import mockRaf from '../fixtures/mocks/request-animation-frame';
import { storeWithProfile } from '../fixtures/stores';
import {
  getBoundingBox,
  addRootOverlayElement,
  removeRootOverlayElement,
  getMouseEvent,
} from '../fixtures/utils';
import { enableEventDelayTracks } from '../../actions/app';
import { getProfileWithEventDelays } from '../fixtures/profiles/processed-profile';

import type { IndexIntoSamplesTable } from 'firefox-profiler/types';
import type { CssPixels } from '../../types/units';

// The following constants determine the size of the drawn graph.
const SAMPLE_COUNT = 8;
const PIXELS_PER_SAMPLE = 10;
const GRAPH_WIDTH = PIXELS_PER_SAMPLE * SAMPLE_COUNT;
const GRAPH_HEIGHT = 10;

function getSamplesPixelPosition(
  sampleIndex: IndexIntoSamplesTable
): CssPixels {
  // Compute the pixel position of the center of a given sample.
  return sampleIndex * PIXELS_PER_SAMPLE + PIXELS_PER_SAMPLE * 0.5;
}

/**
 * This test verifies that the event delay track can draw a graph of the responsiveness.
 */
describe('TrackEventDelay', function() {
  function setup(isTrackEnabled: boolean = true) {
    const profile = getProfileWithEventDelays();
    const store = storeWithProfile(profile);
    const { getState, dispatch } = store;
    const flushRafCalls = mockRaf();
    const ctx = mockCanvasContext();

    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ctx);

    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => getBoundingBox(GRAPH_WIDTH, GRAPH_HEIGHT));

    // Enable the event delay tracks if we want to see them, they are disabled by default
    if (isTrackEnabled) {
      dispatch(enableEventDelayTracks());
    }

    const renderResult = render(
      <Provider store={store}>
        <TrackEventDelay threadIndex={0} />
      </Provider>
    );
    const { container } = renderResult;

    // WithSize uses requestAnimationFrame
    flushRafCalls();

    const canvas = ensureExists(
      container.querySelector('.timelineTrackMemoryCanvas'),
      `Couldn't find the event delay canvas, with selector .timelineTrackMemoryCanvas`
    );
    const getTooltipContents = () =>
      document.querySelector('.timelineTrackMemoryTooltip');
    const getEventDelayDot = () =>
      container.querySelector('.timelineTrackMemoryGraphDot');
    const moveMouseAtEventDelay = index =>
      fireEvent(
        canvas,
        getMouseEvent('mousemove', { pageX: getSamplesPixelPosition(index) })
      );

    return {
      ...renderResult,
      dispatch,
      getState,
      profile,
      store,
      canvas,
      getTooltipContents,
      moveMouseAtEventDelay,
      ctx,
      flushRafCalls,
      getEventDelayDot,
    };
  }

  beforeEach(addRootOverlayElement);
  afterEach(removeRootOverlayElement);

  it('matches the component snapshot', () => {
    const { container } = setup(false);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches the 2d canvas draw snapshot', () => {
    const { ctx, flushRafCalls } = setup();
    flushRafCalls();
    expect(ctx.__flushDrawLog()).toMatchSnapshot();
  });

  it('can create a tooltip', function() {
    const { moveMouseAtEventDelay, getTooltipContents, canvas } = setup();
    expect(getTooltipContents()).toBeFalsy();
    moveMouseAtEventDelay(1);
    expect(getTooltipContents()).toBeTruthy();
    fireEvent.mouseLeave(canvas);
    expect(getTooltipContents()).toBeFalsy();
  });

  it('has a tooltip that matches the snapshot', function() {
    const { moveMouseAtEventDelay, getTooltipContents } = setup();
    moveMouseAtEventDelay(5);
    expect(getTooltipContents()).toMatchSnapshot();
  });

  it('draws a dot on the graph', function() {
    const { moveMouseAtEventDelay, getEventDelayDot } = setup();
    expect(getEventDelayDot()).toBeFalsy();
    moveMouseAtEventDelay(1);
    expect(getEventDelayDot()).toBeTruthy();
  });

  it('draws a dot that matches the snapshot', function() {
    const { moveMouseAtEventDelay, getEventDelayDot } = setup();
    moveMouseAtEventDelay(1);
    expect(getEventDelayDot()).toMatchSnapshot();
  });
});
