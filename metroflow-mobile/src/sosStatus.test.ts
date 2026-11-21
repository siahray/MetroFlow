import { expect, test } from 'bun:test';

import { SOS_STAGES, sosPhase, sosStepStates } from './sosStatus';

test('maps dispatcher statuses to the four alert phases', () => {
  expect(sosPhase('pending')).toBe('received');
  expect(sosPhase('holding')).toBe('received');
  expect(sosPhase(undefined)).toBe('received');
  expect(sosPhase('ASSIGNED')).toBe('accepted');
  expect(sosPhase('dispatched')).toBe('accepted');
  expect(sosPhase('rejected')).toBe('rejected');
  expect(sosPhase('resolved')).toBe('completed');
});

test('step states advance with the SOS lifecycle and stop when rejected', () => {
  expect(sosStepStates('pending')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
  expect(sosStepStates('assigned')).toEqual(['done', 'done', 'current', 'upcoming']);
  expect(sosStepStates('resolved')).toEqual(['done', 'done', 'done', 'done']);
  expect(sosStepStates('rejected')).toEqual(['done', 'done', 'skipped', 'skipped']);
  expect(sosStepStates('pending')).toHaveLength(SOS_STAGES.length);
});
