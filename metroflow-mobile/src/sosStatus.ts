/** The four alert states the driver sees while an SOS moves through dispatch. */
export type SOSPhase = 'received' | 'accepted' | 'rejected' | 'completed';

export type SOSStepState = 'done' | 'current' | 'upcoming' | 'skipped';

export const SOS_STAGES = [
  'Signal sent',
  'Dispatch review',
  'Unit dispatched',
  'Rescue completed',
] as const;

/** Backend SOS statuses are free text; anything unrecognised stays "received". */
export function sosPhase(status: string | null | undefined): SOSPhase {
  switch ((status ?? '').toLowerCase()) {
    case 'rejected':
      return 'rejected';
    case 'resolved':
      return 'completed';
    case 'assigned':
    case 'confirmed':
    case 'dispatched':
      return 'accepted';
    default:
      return 'received';
  }
}

/** One state per SOS_STAGES entry, in the same order. */
export function sosStepStates(status: string | null | undefined): SOSStepState[] {
  switch (sosPhase(status)) {
    case 'completed':
      return ['done', 'done', 'done', 'done'];
    case 'accepted':
      return ['done', 'done', 'current', 'upcoming'];
    case 'rejected':
      return ['done', 'done', 'skipped', 'skipped'];
    default:
      return ['done', 'current', 'upcoming', 'upcoming'];
  }
}
