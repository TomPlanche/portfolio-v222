// Maintenance mode.
//
// When `MAINTENANCE` is set to a truthy value, every page shows only the planes
// sky and one sentence, with `MAINTENANCE_REASON` after it when it is set. Both
// come from `$env/dynamic/private`, so a restart of the built server is enough
// to turn the mode on or off: no new build.

import { env } from '$env/dynamic/private';

export type Maintenance = {
  /** Why the site is down, as written in the environment. */
  reason: string | null;
};

const TRUTHY = ['1', 'true', 'yes', 'on'];

/** The maintenance state, or `null` when the site runs as usual. */
export const getMaintenance = (): Maintenance | null => {
  const flag = env.MAINTENANCE?.trim().toLowerCase() ?? '';

  if (!TRUTHY.includes(flag)) {
    return null;
  }

  const reason = env.MAINTENANCE_REASON?.trim();

  return { reason: reason ? reason : null };
};
