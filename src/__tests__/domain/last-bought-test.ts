import { describeLastBought } from '@/domain/last-bought';

const at = (iso: string) => new Date(iso).getTime();
const now = at('2026-11-06T09:00:00');

test.each([
  ['2026-11-06T08:00:00', 'Last bought today'],
  ['2026-11-06T00:00:01', 'Last bought today'],
  ['2026-11-06T23:00:00', 'Last bought today'], // a clock change can put it slightly ahead
  ['2026-11-05T23:59:00', 'Last bought yesterday'],
  ['2026-11-04T09:00:00', 'Last bought 2 days ago'],
  ['2026-10-31T09:00:00', 'Last bought 6 days ago'],
  ['2026-10-30T09:00:00', 'Last bought Oct 30'],
  ['2025-12-25T09:00:00', 'Last bought Dec 25, 2025'],
])('%s → %s', (boughtAt, expected) => {
  expect(describeLastBought(at(boughtAt), now, 'en-US')).toBe(expected);
});
