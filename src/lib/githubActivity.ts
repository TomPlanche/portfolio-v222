// The shape of the "recent activity" feed, shared by the server loader and the
// component that renders it.
//
// The events come from the GitHub snapshot written hourly by
// https://github.com/TomPlanche/vps-cron, read off disk at the path in
// `GITHUB_ACTIVITY_FILE`. That snapshot is a set of parallel lists (issues,
// pull requests, stars); `$lib/server/githubActivity` flattens them into the
// single chronological list described here.

/** What happened. Drives both the label and the colour of an event. */
export type ActivityKind =
  'pr-opened' | 'pr-merged' | 'pr-closed' | 'issue-opened' | 'issue-closed' | 'star';

export type ActivityEvent = {
  /** Stable across snapshots, so `{#each}` can key on it. */
  id: string;
  kind: ActivityKind;
  /** The pull request or issue title; the repository name for a star. */
  title: string;
  url: string;
  /** `owner/name`. */
  repository: string;
  /** ISO 8601 instant the event is filed under. */
  at: string;
  /** Second line: a diffstat, a comment count, a repository description. */
  detail?: string;
};

export type ActivityFeed = {
  /** Everything a wide viewport shows, newest first. */
  events: ActivityEvent[];
  /**
   * How many of them a narrow viewport shows. The server cannot know the
   * viewport, so it sends the full list and `ActivityList` hides the tail in
   * CSS: no flash on hydration, no reflow on resize.
   */
  compactLimit: number;
};

/**
 * Wording is deliberately uneven: opening is something I did, merging and
 * closing is usually something a maintainer did to my pull request.
 */
export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  'pr-opened': 'opened pr',
  'pr-merged': 'pr merged',
  'pr-closed': 'pr closed',
  'issue-opened': 'opened issue',
  'issue-closed': 'issue closed',
  star: 'starred'
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60]
];

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Coarse relative time, e.g. "3 days ago". Anything under a minute is "just now". */
export const formatRelative = (iso: string, now: number = Date.now()): string => {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const magnitude = Math.abs(seconds);

  for (const [unit, size] of UNITS) {
    if (magnitude >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }

  return 'just now';
};

/** Full timestamp, used as the `title` of a relative one. */
export const formatAbsolute = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
