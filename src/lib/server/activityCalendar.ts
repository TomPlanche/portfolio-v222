// Reads the calendar export of hairball from disk. Server-only, like
// `githubActivity`: the filesystem access and the cache stay off the client.
//
// `ACTIVITY_CALENDAR_FILE` points at the JSON that hairball writes after each
// sync, e.g. `/srv/hairball/calendar.json`. Without it the page shows an
// empty state rather than failing. It is read through `$env/dynamic/private`,
// so it comes from the process environment at runtime.

import { readFile, stat } from 'node:fs/promises';

import { env } from '$env/dynamic/private';

import { todayIn, type ActivityCalendarData, type Calendar } from '$lib/activityCalendar';

const DEFAULT_TIMEZONE = 'Europe/Paris';

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Enough of a check that a broken export cannot crash the page. */
const isCalendar = (value: unknown): value is Calendar => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const calendar = value as Record<string, unknown>;

  return (
    typeof calendar.timezone === 'string' &&
    isDate(calendar.from) &&
    isDate(calendar.to) &&
    calendar.from <= calendar.to &&
    typeof calendar.sources === 'object' &&
    calendar.sources !== null &&
    Array.isArray(calendar.days) &&
    calendar.days.every(
      (day: unknown) =>
        typeof day === 'object' &&
        day !== null &&
        isDate((day as Record<string, unknown>).date) &&
        typeof (day as Record<string, unknown>).by_source === 'object'
    )
  );
};

/** hairball renames a temporary file over the export, so size and mtime change with it. */
let cache: { calendar: Calendar; signature: string } | null = null;

const today = (calendar: Calendar | null): string => {
  try {
    return todayIn(calendar?.timezone ?? DEFAULT_TIMEZONE);
  } catch {
    // An unknown time zone in the export.
    return todayIn(DEFAULT_TIMEZONE);
  }
};

/**
 * The calendar, and today in its time zone.
 *
 * Never throws: an export that cannot be read falls back to the last one
 * parsed, and to `null` if there has not been one yet.
 */
export const loadActivityCalendar = async (): Promise<ActivityCalendarData> => {
  const path = env.ACTIVITY_CALENDAR_FILE;

  if (!path) {
    console.warn(
      '[calendar] ACTIVITY_CALENDAR_FILE is unset, the calendar stays empty. The built server does not read .env by itself.'
    );
    return { calendar: null, today: today(null) };
  }

  try {
    const stats = await stat(path);
    const signature = `${stats.mtimeMs}:${stats.size}`;

    if (cache?.signature !== signature) {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));

      if (!isCalendar(parsed)) {
        throw new Error('the file is not a hairball calendar export');
      }

      cache = { calendar: parsed, signature };
    }
  } catch (error) {
    console.warn(`[calendar] cannot read the export at ${path}:`, error);
  }

  const calendar = cache?.calendar ?? null;

  return { calendar, today: today(calendar) };
};
