// Reads and atomically rewrites the committed registry at
// `src/lib/atproto/records.json`: the slug -> record key mapping that
// makes republishing idempotent (a TID is minted once, at first publish,
// and reused after that), and the payload hash that lets an unchanged
// post skip its `putRecord` call entirely.

import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { EMPTY_REGISTRY, type RecordsRegistry } from '../../src/lib/atproto/records.ts';

const REGISTRY_DIR = join(process.cwd(), 'src/lib/atproto');
const REGISTRY_PATH = join(REGISTRY_DIR, 'records.json');

export const loadRegistry = async (): Promise<RecordsRegistry> => {
  try {
    return JSON.parse(await readFile(REGISTRY_PATH, 'utf8')) as RecordsRegistry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return structuredClone(EMPTY_REGISTRY);
    }
    throw error;
  }
};

/**
 * Writes via a temp file in the same directory, then renames over the
 * original -- a crash mid-write can never leave `records.json` truncated
 * or half-written, and the rename stays on one filesystem.
 */
export const saveRegistry = async (registry: RecordsRegistry): Promise<void> => {
  const tmpFile = join(REGISTRY_DIR, `.records.json.${process.pid}.tmp`);

  await writeFile(tmpFile, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await rename(tmpFile, REGISTRY_PATH);
};

export const hashPayload = (payload: unknown): string =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');
