const DAY = 24 * 60 * 60 * 1000;

/** Days between two times, counted in calendar days in the local time zone. */
function calendarDaysBetween(earlier: number, later: number): number {
  const start = new Date(earlier);
  const end = new Date(later);
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDay - startDay) / DAY);
}

/**
 * "Last bought today", "yesterday", "3 days ago" (within a week), then a date: "Nov 3", with the
 * year when it isn't this year ("Nov 3, 2025").
 */
export function describeLastBought(boughtAt: number, now: number, locale?: string): string {
  const days = calendarDaysBetween(boughtAt, now);
  if (days <= 0) return 'Last bought today';
  if (days === 1) return 'Last bought yesterday';
  if (days < 7) return `Last bought ${days} days ago`;
  const sameYear = new Date(boughtAt).getFullYear() === new Date(now).getFullYear();
  const date = new Date(boughtAt).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `Last bought ${date}`;
}
