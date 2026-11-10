import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';

import { DialogProvider, useDialog } from '../src/components/Dialog';
import { ThemeProvider } from '../src/theme';

const results: unknown[] = [];

function Harness() {
  const { confirm, notice } = useDialog();
  return (
    <>
      <TouchableOpacity
        accessibilityLabel="ask"
        onPress={() =>
          void confirm({
            title: 'Sign out?',
            message: 'You will need your password.',
            confirmLabel: 'Sign Out',
            destructive: true,
          }).then((ok) => results.push(ok))
        }
      >
        <Text>ask</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="tell"
        onPress={() => void notice({ title: 'Saved', message: 'All good.' }).then(() => results.push('noticed'))}
      >
        <Text>tell</Text>
      </TouchableOpacity>
    </>
  );
}

function renderHarness() {
  return render(
    <ThemeProvider>
      <DialogProvider>
        <Harness />
      </DialogProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  results.length = 0;
});

test('confirm resolves true only from the confirm button', async () => {
  await renderHarness();
  await fireEvent.press(screen.getByLabelText('ask'));
  expect(screen.getByText('Sign out?')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Sign Out'));
  await waitFor(() => expect(results).toEqual([true]));
  expect(screen.queryByText('Sign out?')).toBeNull();
});

test('confirm resolves false when cancelled or dismissed', async () => {
  await renderHarness();
  await fireEvent.press(screen.getByLabelText('ask'));
  await fireEvent.press(screen.getByLabelText('Cancel'));
  await waitFor(() => expect(results).toEqual([false]));

  await fireEvent.press(screen.getByLabelText('ask'));
  await fireEvent.press(screen.getByLabelText('Dismiss dialog'));
  await waitFor(() => expect(results).toEqual([false, false]));
});

test('notice shows one OK button and resolves when acknowledged', async () => {
  await renderHarness();
  await fireEvent.press(screen.getByLabelText('tell'));
  expect(screen.getByText('Saved')).toBeTruthy();
  expect(screen.queryByLabelText('Cancel')).toBeNull();

  await fireEvent.press(screen.getByLabelText('OK'));
  await waitFor(() => expect(results).toEqual(['noticed']));
});
