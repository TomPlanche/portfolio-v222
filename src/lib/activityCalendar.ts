// The shape of the activity calendar, shared by the server loader and the
// component that renders it.
//
// The data comes from hairball, a Rust CLI that collects my public activity
// (GitHub, ATProto apps, Last.fm...) into one SQLite file and exports one year
// of it as JSON, read off disk at the path in `ACTIVITY_CALENDAR_FILE`.
//
// Dates are `YYYY-MM-DD` strings, already grouped in the time zone of the
// export. Every computation below works on them in UTC, so the time zone of
// the server or of the browser never moves a day.

export type CalendarSource = {
  label: string;
  /** Highest count of one day for this source, used to normalize it. */
  max: number;
};

export type CalendarDay = {
  date: string;
  total: number;
  by_source: Record<string, number>;
};

/** The export of hairball, as it is on disk. */
export type Calendar = {
  /** IANA name, e.g. `Europe/Paris`. */
  timezone: string;
  from: string;
  to: string;
  sources: Record<string, CalendarSource>;
  /** Only the days with activity, in order. */
  days: CalendarDay[];
};

export type ActivityCalendarData = {
  /** `null` when the export cannot be read. */
  calendar: Calendar | null;
  /** Today in the time zone of the export, so later days render as empty. */
  today: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` to a UTC timestamp at midnight. */
export const parseDate = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
};

export const formatIsoDate = (time: number): string => new Date(time).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string =>
  formatIsoDate(parseDate(date) + days * DAY_MS);

/** 0 for Monday, 6 for Sunday: the calendar starts its weeks on Monday. */
export const weekdayOf = (date: string): number => (new Date(parseDate(date)).getUTCDay() + 6) % 7;

/** Today in an IANA time zone, as `YYYY-MM-DD`. */
export const todayIn = (timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

/**
 * Sources that run in the background. Last.fm scrobbles every song, so it has
 * activity on almost every day and would paint the whole calendar in its
 * colour. A day takes the colour of a background source only when nothing
 * else happened on it.
 */
export const BACKGROUND_SOURCES: ReadonlySet<string> = new Set(['lastfm', 'teal', 'rocksky']);

/** Brand colours where the brand has one that reads on a dark page. */
const SOURCE_COLORS: Record<string, string> = {
  github: '#3fb950',
  bluesky: '#1185fe',
  lastfm: '#e0464b',
  tangled: '#c9a26b',
  sifa: '#8b7cf6',
  teal: '#2dd4bf',
  rocksky: '#d946ef',
  'com.tomplanche.atkuzu': '#f59e0b'
};

/** A stable hue per key, so an unknown source keeps its colour from one export to the next. */
const hashHue = (key: string): number => {
  let hash = 0;

  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash % 360;
};

export const sourceColor = (key: string): string =>
  SOURCE_COLORS[key] ?? `hsl(${hashHue(key)} 55% 62%)`;

/**
 * How busy a day was for one source, from 0 to 1. Logarithmic: the step from 1
 * to 5 events says more than the step from 200 to 300 scrobbles.
 */
export const intensity = (count: number, max: number): number =>
  count <= 0 || max <= 0 ? 0 : Math.min(1, Math.log1p(count) / Math.log1p(max));

/** The 4 shades of a cell, plus 0 for a day without activity. */
export type Level = 0 | 1 | 2 | 3 | 4;

export const levelOf = (value: number): Level =>
  value <= 0 ? 0 : (Math.min(4, Math.max(1, Math.ceil(value * 4))) as Level);

/** One square of the heatmap. */
export type DayCell = {
  date: string;
  /** Monday-based column and row in the grid. */
  week: number;
  weekday: number;
  /** Events counted for the current filter. */
  count: number;
  level: Level;
  /** The source that gives the cell its colour, `null` on an empty day. */
  lead: string | null;
  future: boolean;
};

/**
 * The source that best describes a day: the busiest one relative to its own
 * `max`, with the background sources considered only when nothing else is there.
 */
const leadOf = (
  day: CalendarDay,
  sources: Calendar['sources'],
  counts: (key: string) => boolean
): { key: string; value: number } | null => {
  let best: { key: string; value: number; background: boolean } | null = null;

  for (const [key, count] of Object.entries(day.by_source)) {
    const value = intensity(count, sources[key]?.max ?? count);
    const background = BACKGROUND_SOURCES.has(key);

    if (value <= 0 || !counts(key)) {
      continue;
    }

    const better =
      best === null ||
      (best.background && !background) ||
      (best.background === background && value > best.value);

    if (better) {
      best = { key, value, background };
    }
  }

  return best;
};

/**
 * Every day from `from` to `to`, placed in a Monday-first week grid.
 *
 * A cell counts the sources in `shown` (all of them when `shown` is empty),
 * minus the `excluded` ones, and takes the colour and the shade of its lead
 * source among them.
 */
export const buildCells = (
  calendar: Calendar,
  today: string,
  shown: ReadonlySet<string> = new Set(),
  excluded: ReadonlySet<string> = new Set()
): DayCell[] => {
  const counts = (key: string): boolean =>
    (shown.size === 0 || shown.has(key)) && !excluded.has(key);
  const byDate = new Map(calendar.days.map((day) => [day.date, day]));
  const start = parseDate(calendar.from) - weekdayOf(calendar.from) * DAY_MS;
  const end = parseDate(calendar.to);
  const cells: DayCell[] = [];

  for (let time = parseDate(calendar.from); time <= end; time += DAY_MS) {
    const date = formatIsoDate(time);
    const day = byDate.get(date);
    const offset = Math.round((time - start) / DAY_MS);
    const cell: DayCell = {
      date,
      week: Math.floor(offset / 7),
      weekday: offset % 7,
      count: 0,
      level: 0,
      lead: null,
      future: date > today
    };

    if (day) {
      const lead = leadOf(day, calendar.sources, counts);

      cell.count = Object.entries(day.by_source)
        .filter(([key]) => counts(key))
        .reduce((sum, [, count]) => sum + count, 0);
      cell.level = levelOf(lead?.value ?? 0);
      cell.lead = lead?.key ?? null;
    }

    cells.push(cell);
  }

  return cells;
};

export type MonthLabel = { week: number; label: string };

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

/** One label per month, over the first week that holds its first day in range. */
export const monthLabels = (cells: DayCell[]): MonthLabel[] =>
  cells
    .filter((cell, index) => index === 0 || cell.date.endsWith('-01'))
    .map((cell) => ({ week: cell.week, label: MONTH.format(parseDate(cell.date)) }))
    // A range that starts late in a month would put two labels on top of each other.
    .filter(
      (label, index, labels) =>
        index === labels.length - 1 || labels[index + 1].week - label.week >= 2
    );

export type CalendarStats = {
  events: number;
  activeDays: number;
  longestStreak: number;
  /** The streak that runs up to today, or up to yesterday when today is still empty. */
  currentStreak: number;
};

export const statsOf = (cells: DayCell[]): CalendarStats => {
  const past = cells.filter((cell) => !cell.future);
  let events = 0;
  let activeDays = 0;
  let longestStreak = 0;
  let streak = 0;

  for (const cell of past) {
    events += cell.count;
    activeDays += cell.count > 0 ? 1 : 0;
    streak = cell.count > 0 ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }

  // An empty today does not break the streak yet: the day is not over.
  let index = past.length - 1;

  if (past[index]?.count === 0) {
    index -= 1;
  }

  let currentStreak = 0;

  while (index >= 0 && past[index].count > 0) {
    currentStreak += 1;
    index -= 1;
  }

  return { events, activeDays, longestStreak, currentStreak };
};

export type SourceSummary = {
  key: string;
  label: string;
  color: string;
  events: number;
  activeDays: number;
};

/** The sources of the year, the ones I use on the most days first. */
export const summarizeSources = (calendar: Calendar): SourceSummary[] => {
  const totals = new Map<string, { events: number; activeDays: number }>();

  for (const day of calendar.days) {
    for (const [key, count] of Object.entries(day.by_source)) {
      const total = totals.get(key) ?? { events: 0, activeDays: 0 };

      total.events += count;
      total.activeDays += count > 0 ? 1 : 0;
      totals.set(key, total);
    }
  }

  return Object.entries(calendar.sources)
    .map(([key, source]) => ({
      key,
      label: source.label,
      color: sourceColor(key),
      events: totals.get(key)?.events ?? 0,
      activeDays: totals.get(key)?.activeDays ?? 0
    }))
    .filter((source) => source.events > 0)
    .sort(
      (a, b) => b.activeDays - a.activeDays || b.events - a.events || a.label.localeCompare(b.label)
    );
};

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
});

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC'
});

export const formatLongDate = (date: string): string => LONG_DATE.format(parseDate(date));

export const formatShortDate = (date: string): string => SHORT_DATE.format(parseDate(date));

export const plural = (count: number, noun: string): string =>
  `${count.toLocaleString('en-GB')} ${noun}${count === 1 ? '' : 's'}`;
