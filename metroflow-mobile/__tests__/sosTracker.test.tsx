import React from 'react';
import { act, renderHook, screen } from '@testing-library/react-native';

import { getSOS, getSOSLog, type SOSRequest } from '../src/api';
import { loadCache, saveCache } from '../src/offline';
import { SOSTrackerProvider, useSOSTracker } from '../src/sosTracker';

jest.mock('../src/api', () => ({
  getSOS: jest.fn(),
  getSOSLog: jest.fn(() => Promise.resolve([])),
}));
jest.mock('../src/offline', () => ({
  loadCache: jest.fn(() => Promise.resolve(null)),
  saveCache: jest.fn(() => Promise.resolve()),
}));
jest.mock('../src/components/SOSUpdateModal', () => {
  const ReactLib = require('react');
  const { View: NativeView } = require('react-native');
  return {
    SOSUpdateModal: ({ visible, sos }: { visible: boolean; sos: unknown }) =>
      visible ? ReactLib.createElement(NativeView, { testID: 'sos-modal', sos }) : null,
  };
});

const pending: SOSRequest = {
  sos_id: 42,
  latitude: 14.6,
  longitude: 121.0,
  note: null,
  reporter_phone: null,
  plate_number: null,
  vehicle_id: null,
  status: 'pending',
  created_at: null,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SOSTrackerProvider>{children}</SOSTrackerProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  (loadCache as jest.Mock).mockResolvedValue(null);
  (getSOSLog as jest.Mock).mockResolvedValue([]);
});

test('a resolved SOS resets the screen but its completion notice still shows the incident', async () => {
  (getSOS as jest.Mock).mockResolvedValue({ ...pending, status: 'resolved' });
  const { result } = await renderHook(() => useSOSTracker(), { wrapper });
  await act(async () => {});
  expect(loadCache).toHaveBeenCalled();

  await act(async () => {
    result.current.track(pending);
  });
  expect(result.current.activeSOS?.status).toBe('pending');

  await act(async () => {
    await result.current.refresh();
  });

  expect(result.current.activeSOS).toBeNull();
  expect(screen.getByTestId('sos-modal').props.sos).toMatchObject({ sos_id: 42, status: 'resolved' });
  expect(saveCache).toHaveBeenCalledWith('active_sos', null);
});

test('a rejected SOS stays on screen until the driver dismisses it', async () => {
  (getSOS as jest.Mock).mockResolvedValue({ ...pending, status: 'rejected' });
  const { result } = await renderHook(() => useSOSTracker(), { wrapper });
  await act(async () => {});
  expect(loadCache).toHaveBeenCalled();

  await act(async () => {
    result.current.track(pending);
  });
  await act(async () => {
    await result.current.refresh();
  });

  expect(result.current.activeSOS?.status).toBe('rejected');
  expect(saveCache).toHaveBeenCalledWith('active_sos', {
    sosId: 42,
    lastSeenStatus: 'rejected',
  });
});
