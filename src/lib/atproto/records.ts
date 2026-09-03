// Shared types for the `site.standard.*` records synced to ATProto.
//
// No `$lib`/`$env` imports on purpose: this file is loaded two ways, as
// `$lib/atproto/records.ts` inside the SvelteKit app, and as a plain
// relative import from the standalone publish script in `scripts/atproto/`,
// which runs outside Vite and cannot resolve those aliases.

export type RecordEntry = {
  /** Record key (a TID) this slug, or the publication, was written under. */
  rkey: string;
  /** SHA-256 of the exact payload last written, so an unchanged post is skipped on the next publish. */
  payloadHash: string;
};

export type RecordsRegistry = {
  /** The account's DID, filled in after the first successful session. `null` before the first publish. */
  did: string | null;
  publication: RecordEntry | null;
  /** Keyed by post slug, not file path, so renaming a post's source file does not orphan its record. */
  documents: Record<string, RecordEntry>;
};

export const EMPTY_REGISTRY: RecordsRegistry = {
  did: null,
  publication: null,
  documents: {}
};

/** The `at://` URI of a record. */
export const atUri = (
  did: string,
  collection: 'site.standard.publication' | 'site.standard.document',
  rkey: string
): string => `at://${did}/${collection}/${rkey}`;
