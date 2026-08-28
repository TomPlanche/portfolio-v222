// Reads the GitHub snapshot from disk and flattens it into the feed rendered by
// `ActivityList`. Server-only: `$lib/server` is never shipped to the browser,
// which keeps both the filesystem access and the cache below off the client.
//
// `GITHUB_ACTIVITY_FILE` points at the JSON that vps-cron writes, e.g.
// `/srv/static/github_activity.json`. Without it the section renders empty
// rather than failing. Three optional variables tune the feed:
//
//   GITHUB_ACTIVITY_LIMIT          how many events a wide viewport shows (default 12)
//   GITHUB_ACTIVITY_COMPACT_LIMIT  how many a narrow one shows (default 6)
//   GITHUB_ACTIVITY_MAX_STARS      how many of those may be stars (default 3)
//   GITHUB_ACTIVITY_HIDDEN_REPOS   comma-separated repositories to leave out
//   GITHUB_ACTIVITY_HIDDEN_TITLES  comma-separated PR title markers to leave out
//
// They are read through `$env/dynamic/private`, so they come from the process
// environment at runtime. `vite dev` loads `.env` on its own; the built server
// does not, so the deployment has to put the variables in the environment
// itself. `npm run serve` does it with node's `--env-file-if-exists`.

import { readFile, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';

import { env } from '$env/dynamic/private';

import type { ActivityEvent, ActivityFeed } from '$lib/githubActivity';

/**
 * Repositories kept out of the feed no matter what the environment says.
 *
 * Entries are matched case-insensitively and take three shapes:
 * `owner/name` hides one repository, `owner/*` and a bare `owner` hide
 * everything under that account. `GITHUB_ACTIVITY_HIDDEN_REPOS` adds to this
 * list rather than replacing it, so anything that belongs in git can live here
 * and anything deployment-specific can stay in the environment.
 */
const ALWAYS_HIDDEN_REPOS: string[] = [];

/**
 * Pull request titles kept out of the feed no matter what the environment says.
 *
 * An entry hides any pull request whose title contains it, matched
 * case-insensitively: `[chore]` covers `[CHORE] Bump deps` and `[Chore] tidy up`
 * alike. Chores are the reason this exists; they are real work but they say
 * nothing about what I am building. Issues and stars are left alone, these
 * markers are a pull request convention.
 *
 * `GITHUB_ACTIVITY_HIDDEN_TITLES` adds to this list rather than replacing it,
 * on the same reasoning as `ALWAYS_HIDDEN_REPOS`.
 */
const ALWAYS_HIDDEN_TITLES: string[] = ['[chore]'];

/** Stars are frequent enough to drown everything else; keep the feed about work. */
const DEFAULT_MAX_STARS = 3;

const DEFAULT_LIMIT = 12;

/** One column of six rows below the breakpoint, two columns of six above it. */
const DEFAULT_COMPACT_LIMIT = 6;

type SnapshotIssue = {
  number: number;
  title: string;
  url: string;
  /** `OPEN` or `CLOSED`. */
  state: string;
  repository: string;
  comments: number;
  created_at: string;
  updated_at: string;
};

type SnapshotPullRequest = {
  number: number;
  title: string;
  url: string;
  /** `OPEN`, `CLOSED` or `MERGED`. */
  state: string;
  repository: string;
  additions: number;
  deletions: number;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
};

type SnapshotStar = {
  repository: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
  starred_at: string;
};

type Snapshot = {
  fetched_at: string;
  login: string;
  issues: SnapshotIssue[];
  pull_requests: SnapshotPullRequest[];
  starred: SnapshotStar[];
};

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

const pullRequestEvent = (pr: SnapshotPullRequest): ActivityEvent => {
  const mergedAt = pr.merged_at;
  const closed = mergedAt === null && pr.state === 'CLOSED';

  return {
    id: `pr:${pr.repository}#${pr.number}`,
    kind: mergedAt !== null ? 'pr-merged' : closed ? 'pr-closed' : 'pr-opened',
    title: pr.title,
    url: pr.url,
    repository: pr.repository,
    // The snapshot has no `closed_at`, so a closed pull request is filed under
    // its last update. Merged and open ones have an exact instant.
    at: mergedAt ?? (closed ? pr.updated_at : pr.created_at),
    detail: `+${pr.additions} -${pr.deletions}`
  };
};

const issueEvent = (issue: SnapshotIssue): ActivityEvent => {
  const closed = issue.state === 'CLOSED';

  return {
    id: `issue:${issue.repository}#${issue.number}`,
    kind: closed ? 'issue-closed' : 'issue-opened',
    title: issue.title,
    url: issue.url,
    repository: issue.repository,
    // Same caveat as above: no `closed_at` in the snapshot.
    at: closed ? issue.updated_at : issue.created_at,
    detail: issue.comments > 0 ? plural(issue.comments, 'comment') : undefined
  };
};

const starEvent = (star: SnapshotStar): ActivityEvent => ({
  id: `star:${star.repository}`,
  kind: 'star',
  title: star.repository,
  url: star.url,
  repository: star.repository,
  at: star.starred_at,
  detail: star.description ?? undefined
});

const newestFirst = (a: ActivityEvent, b: ActivityEvent): number =>
  new Date(b.at).getTime() - new Date(a.at).getTime();

/** Splits a comma-separated list, dropping blanks so a trailing comma is harmless. */
const parseList = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

const parseCount = (raw: string | undefined, fallback: number, name: string): number => {
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) {
    console.warn(`[activity] ${name} is not a non-negative integer ("${raw}"), using ${fallback}.`);
    return fallback;
  }

  return value;
};

const isHidden = (repository: string, hiddenRepos: string[]): boolean => {
  const name = repository.toLowerCase();
  const owner = name.slice(0, name.indexOf('/'));

  return hiddenRepos.some((entry) => entry === name || entry === owner || entry === `${owner}/*`);
};

/** Substring match, so a marker can sit anywhere in the title, not just in front. */
const hasHiddenTitle = (title: string, hiddenTitles: string[]): boolean => {
  const name = title.toLowerCase();

  return hiddenTitles.some((entry) => name.includes(entry));
};

type FeedConfig = {
  hiddenRepos: string[];
  hiddenTitles: string[];
  maxStars: number;
};

const toEvents = (
  snapshot: Snapshot,
  { hiddenRepos, hiddenTitles, maxStars }: FeedConfig
): ActivityEvent[] => {
  const shown = (event: ActivityEvent): boolean => !isHidden(event.repository, hiddenRepos);

  const shownPullRequest = (event: ActivityEvent): boolean =>
    shown(event) && !hasHiddenTitle(event.title, hiddenTitles);

  // Filtered before the cap, so a hidden repository never costs a star its slot.
  const stars = (snapshot.starred ?? [])
    .map(starEvent)
    .filter(shown)
    .sort(newestFirst)
    .slice(0, maxStars);

  return [
    ...(snapshot.pull_requests ?? []).map(pullRequestEvent).filter(shownPullRequest),
    ...(snapshot.issues ?? []).map(issueEvent).filter(shown),
    ...stars
  ]
    .filter((event) => !Number.isNaN(new Date(event.at).getTime()))
    .sort(newestFirst);
};

/**
 * Identifies a parse of the file. vps-cron rewrites the snapshot hourly, so
 * anything that leaves size and mtime alone left the contents alone too. The
 * config joins in because it decides what the parse keeps.
 */
const signatureOf = (stats: Stats, { hiddenRepos, hiddenTitles, maxStars }: FeedConfig): string =>
  `${stats.mtimeMs}:${stats.size}:${maxStars}:${hiddenRepos.join('|')}:${hiddenTitles.join('|')}`;

let cache: { events: ActivityEvent[]; signature: string } | null = null;

type Options = {
  /** How many events to return. */
  limit?: number;
  /** How many of them a narrow viewport shows. Never more than `limit`. */
  compactLimit?: number;
  /** How many of them may be stars. */
  maxStars?: number;
  /** Repositories to leave out, in the shapes documented on `ALWAYS_HIDDEN_REPOS`. */
  hiddenRepos?: string[];
  /** Pull request title markers to leave out, per `ALWAYS_HIDDEN_TITLES`. */
  hiddenTitles?: string[];
};

/**
 * The most recent GitHub events, newest first, and how many of them a narrow
 * viewport should show.
 *
 * Anything left out of `options` comes from the environment, and anything the
 * environment leaves out comes from the defaults above.
 *
 * Never throws: a snapshot that cannot be read falls back to the last one
 * parsed, and to an empty feed if there has not been one yet. The section is a
 * nicety, it must not take the home page down with it.
 */
export const loadRecentActivity = async (options: Options = {}): Promise<ActivityFeed> => {
  const limit =
    options.limit ?? parseCount(env.GITHUB_ACTIVITY_LIMIT, DEFAULT_LIMIT, 'GITHUB_ACTIVITY_LIMIT');

  // Hiding more than was sent would be a no-op; hiding none of it is valid.
  const compactLimit = Math.min(
    limit,
    options.compactLimit ??
      parseCount(
        env.GITHUB_ACTIVITY_COMPACT_LIMIT,
        DEFAULT_COMPACT_LIMIT,
        'GITHUB_ACTIVITY_COMPACT_LIMIT'
      )
  );

  const path = env.GITHUB_ACTIVITY_FILE;

  if (!path) {
    console.warn(
      '[activity] GITHUB_ACTIVITY_FILE is unset, the feed stays empty. The built server does not read .env by itself.'
    );
    return { events: [], compactLimit };
  }

  const config: FeedConfig = {
    maxStars:
      options.maxStars ??
      parseCount(env.GITHUB_ACTIVITY_MAX_STARS, DEFAULT_MAX_STARS, 'GITHUB_ACTIVITY_MAX_STARS'),
    hiddenRepos:
      options.hiddenRepos ??
      parseList([...ALWAYS_HIDDEN_REPOS, env.GITHUB_ACTIVITY_HIDDEN_REPOS ?? ''].join(',')),
    hiddenTitles:
      options.hiddenTitles ??
      parseList([...ALWAYS_HIDDEN_TITLES, env.GITHUB_ACTIVITY_HIDDEN_TITLES ?? ''].join(','))
  };

  try {
    const signature = signatureOf(await stat(path), config);

    if (cache?.signature === signature)
      return { events: cache.events.slice(0, limit), compactLimit };

    const events = toEvents(JSON.parse(await readFile(path, 'utf8')) as Snapshot, config);

    cache = { events, signature };

    return { events: events.slice(0, limit), compactLimit };
  } catch (error) {
    console.warn(`[activity] cannot read the snapshot at ${path}:`, error);

    return { events: cache?.events.slice(0, limit) ?? [], compactLimit };
  }
};
