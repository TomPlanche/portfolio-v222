// Configuration for the ATProto publish script, read from the environment.
//
// `ATPROTO_APP_PASSWORD` is a secret and lives only in the environment --
// `node --env-file-if-exists=.env` loads it from `.env` locally, the same
// convention the `serve` script uses (see `src/lib/server/githubActivity.ts`).
// Not needed for `--dry-run`, which never authenticates.

export type Config = {
  pdsUrl: string;
  identifier: string;
  appPassword: string;
};

const required = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set. See scripts/atproto/README.md.`);
  }

  return value;
};

export const loadConfig = (): Config => ({
  pdsUrl: required('ATPROTO_PDS_URL'),
  identifier: required('ATPROTO_IDENTIFIER'),
  appPassword: required('ATPROTO_APP_PASSWORD')
});
