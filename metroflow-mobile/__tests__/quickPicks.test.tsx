import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { getNetworkState } from '../src/api';
import { QuickPickList, QuickPicks } from '../src/components/QuickPicks';
import { listQuickPicks, saveQuickPicks, type QuickPick } from '../src/quickPicks';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void) => useEffect(() => void cb(), [cb]),
  };
});
jest.mock('../src/api', () => ({ getNetworkState: jest.fn() }));
jest.mock('../src/quickPicks', () => ({
  listQuickPicks: jest.fn(),
  saveQuickPicks: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockedList = listQuickPicks as jest.MockedFunction<typeof listQuickPicks>;
const mockedSave = saveQuickPicks as jest.MockedFunction<typeof saveQuickPicks>;
const mockedNetwork = getNetworkState as jest.MockedFunction<typeof getNetworkState>;

const work: QuickPick = {
  id: '1',
  name: 'Work HQ',
  nodeId: 1,
  latitude: 14.6,
  longitude: 121,
  icon: 'work',
};

const gym: QuickPick = {
  id: '2',
  name: 'Gym',
  nodeId: 2,
  latitude: 14.61,
  longitude: 121.01,
  icon: 'gym',
};

const network = {
  clearance_cm: 28,
  generated_at: '2026-11-11T00:00:00Z',
  edges: { type: 'FeatureCollection', features: [] },
  nodes: {
    type: 'FeatureCollection',
    features: [
      {
        id: 1,
        geometry: { type: 'Point', coordinates: [121, 14.6] },
        properties: { node_id: 1, name: 'Home Bay', elevation_m: 5 },
      },
      {
        id: 2,
        geometry: { type: 'Point', coordinates: [121.01, 14.61] },
        properties: { node_id: 2, name: 'Gym Annex', elevation_m: 6 },
      },
    ],
  },
} as unknown as Awaited<ReturnType<typeof getNetworkState>>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedSave.mockResolvedValue();
  mockedNetwork.mockResolvedValue(network);
});

function renderModal() {
  return render(<QuickPicks visible onClose={jest.fn()} />);
}

it('shows a loading state until the saved list resolves', async () => {
  let resolve!: (picks: QuickPick[]) => void;
  mockedList.mockReturnValue(new Promise((r) => (resolve = r)));

  await renderModal();
  expect(screen.getByText('Loading Quick Picks…')).toBeTruthy();
  expect(screen.queryByText('No Quick Picks Yet')).toBeNull();

  resolve([]);
  expect(await screen.findByText('No Quick Picks Yet')).toBeTruthy();
});

it('shows the empty state with the add action', async () => {
  mockedList.mockResolvedValue([]);

  await renderModal();

  expect(await screen.findByText('No Quick Picks Yet')).toBeTruthy();
  expect(
    screen.getByText('Save your favorite destinations for faster access to safe routes.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Add a Quick Pick')).toBeTruthy();
});

describe('empty state', () => {
  beforeEach(() => mockedList.mockResolvedValue([]));

  it('adds the first Quick Pick without a confirmation step', async () => {
    await renderModal();

    await fireEvent.press(await screen.findByLabelText('Add a Quick Pick'));
    await fireEvent.changeText(await screen.findByLabelText('Quick Pick name'), 'Work HQ');
    await fireEvent.changeText(screen.getByLabelText('Search destinations'), 'Home');

    await fireEvent.press(await screen.findByLabelText('Destination: Home Bay'));
    await fireEvent.press(screen.getByLabelText('Add Quick Pick'));

    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'Work HQ', nodeId: 1, icon: 'other' }),
      ]),
    );
    expect(await screen.findByText('Work HQ')).toBeTruthy();
    expect(screen.queryByText('No Quick Picks Yet')).toBeNull();
  });
});

describe('editing', () => {
  beforeEach(() => mockedList.mockResolvedValue([work]));

  it('asks for confirmation and keeps the draft when cancelled', async () => {
    await renderModal();

    await fireEvent.press(await screen.findByLabelText('Edit Work HQ'));
    await fireEvent.changeText(await screen.findByLabelText('Quick Pick name'), 'Work HQ 2');
    await fireEvent.press(screen.getByLabelText('Save Changes'));

    expect(await screen.findByText('Save Changes?')).toBeTruthy();
    expect(mockedSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Cancel'));

    await waitFor(() => expect(screen.queryByText('Save Changes?')).toBeNull());
    expect(mockedSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Quick Pick name').props.value).toBe('Work HQ 2');
  });

  it('only writes the update after the confirmation', async () => {
    await renderModal();

    await fireEvent.press(await screen.findByLabelText('Edit Work HQ'));
    await fireEvent.changeText(await screen.findByLabelText('Quick Pick name'), 'Work HQ 2');
    await fireEvent.press(screen.getByLabelText('Save Changes'));
    expect(mockedSave).not.toHaveBeenCalled();

    await fireEvent.press(await screen.findByLabelText('Confirm Save Changes'));

    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', name: 'Work HQ 2', nodeId: 1 }),
      ]),
    );
    expect(await screen.findByText('Work HQ 2')).toBeTruthy();
    expect(screen.queryByText('Save Changes?')).toBeNull();
  });

  it('keeps the draft and reports an error when the write fails', async () => {
    mockedSave.mockRejectedValueOnce(new Error('disk full'));
    await renderModal();

    await fireEvent.press(await screen.findByLabelText('Edit Work HQ'));
    await fireEvent.changeText(await screen.findByLabelText('Quick Pick name'), 'Work HQ 2');
    await fireEvent.press(screen.getByLabelText('Save Changes'));
    await fireEvent.press(await screen.findByLabelText('Confirm Save Changes'));

    expect(
      await screen.findByText('Could not save your changes. Nothing was updated — please try again.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Quick Pick name').props.value).toBe('Work HQ 2');
    expect(screen.queryByText('Save Changes?')).toBeNull();
  });
});

describe('removal', () => {
  it('keeps the Quick Pick when the confirmation is dismissed', async () => {
    mockedList.mockResolvedValue([gym, work]);
    await renderModal();

    await fireEvent.press(await screen.findByLabelText('Remove Work HQ'));

    expect(await screen.findByText('Remove Quick Pick?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Keep It'));

    await waitFor(() => expect(screen.queryByText('Remove Quick Pick?')).toBeNull());
    expect(mockedSave).not.toHaveBeenCalled();
    expect(screen.getByText('Work HQ')).toBeTruthy();
  });

  it('removes only the confirmed pick and shows the empty state after the last one', async () => {
    mockedList.mockResolvedValue([gym, work]);
    await renderModal();

    await fireEvent.press(await screen.findByLabelText('Remove Work HQ'));
    await fireEvent.press(await screen.findByLabelText('Remove'));

    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith([expect.objectContaining({ id: '2' })]),
    );
    expect(screen.queryByText('Work HQ')).toBeNull();

    await fireEvent.press(await screen.findByLabelText('Remove Gym'));
    await fireEvent.press(await screen.findByLabelText('Remove'));

    await waitFor(() =>
      expect(mockedSave).toHaveBeenLastCalledWith([]),
    );
    expect(await screen.findByText('No Quick Picks Yet')).toBeTruthy();
  });
});

describe('Home section', () => {
  it('lists saved picks and routes to the tapped one', async () => {
    mockedList.mockResolvedValue([work, gym]);
    await render(<QuickPickList />);

    await fireEvent.press(await screen.findByLabelText('Route to Work HQ'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/route',
      params: { destination: '14.6,121' },
    });
  });

  it('opens management from the empty prompt and refreshes on close', async () => {
    mockedList.mockResolvedValue([]);
    await render(<QuickPickList />);

    await fireEvent.press(await screen.findByLabelText('Add a quick pick'));
    expect(await screen.findByText('No Quick Picks Yet')).toBeTruthy();

    const calls = mockedList.mock.calls.length;
    await fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(mockedList.mock.calls.length).toBe(calls + 1));
  });
});
