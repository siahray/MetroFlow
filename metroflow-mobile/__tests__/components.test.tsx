import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar, initialsOf } from '../src/components/Avatar';
import { PasswordField } from '../src/components/PasswordField';

describe('initialsOf', () => {
  it('takes up to two initials from a name', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('grace.hopper@navy.mil')).toBe('GH');
  });

  it('falls back to ? for empty or missing names', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  it('shows the initials and labels itself for a named user', async () => {
    await render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByText('AL')).toBeTruthy();
    expect(screen.getByLabelText('Signed in as Ada Lovelace')).toBeTruthy();
  });

  it('labels itself as Guest when there is no name', async () => {
    await render(<Avatar />);
    expect(screen.getByText('?')).toBeTruthy();
    expect(screen.getByLabelText('Guest')).toBeTruthy();
  });
});

describe('PasswordField', () => {
  it('toggles visibility and forwards edits', async () => {
    const onChangeText = jest.fn();
    await render(<PasswordField label="Password" value="" onChangeText={onChangeText} />);

    const input = screen.getByLabelText('Password');
    expect(input.props.secureTextEntry).toBe(true);

    fireEvent.changeText(input, 'hunter2');
    expect(onChangeText).toHaveBeenCalledWith('hunter2');
  });
});
