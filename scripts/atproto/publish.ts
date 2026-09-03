// Publishes the blog's posts to ATProto as `site.standard.*` records, so
// the blog shows up in ATmosphere readers (Leaflet, pckt, Offprint, Sifa
// ID, Frontpage...) without any of them having to scrape the site.
//
// See scripts/atproto/README.md for the required environment variables.
// Idempotent: an unchanged post's payload hash matches what's already in
// `records.json` and is skipped, and a post no longer published gets its
// record deleted and dropped from the registry.
//
//   node --env-file-if-exists=.env scripts/atproto/publish.ts [--dry-run]
//
// `--dry-run` prints what would be written and never authenticates or
// touches the network.

import { createSession, deleteRecord, putRecord, type Session } from './client.ts';
import { loadConfig } from './config.ts';
import { buildDocument, buildPublication, SITE_URL } from './payloads.ts';
import { discoverPosts } from './posts.ts';
import { hashPayload, loadRegistry, saveRegistry } from './registry.ts';
import { nextTid } from './tid.ts';
import { toTextContent } from './textContent.ts';

import { atUri, type RecordEntry, type RecordsRegistry } from '../../src/lib/atproto/records.ts';

const PUBLICATION_COLLECTION = 'site.standard.publication';
const DOCUMENT_COLLECTION = 'site.standard.document';

const dryRun = process.argv.includes('--dry-run');

type UpsertResult = { entry: RecordEntry; changed: boolean };

const upsert = async (
  session: Session | null,
  collection: typeof PUBLICATION_COLLECTION | typeof DOCUMENT_COLLECTION,
  existing: RecordEntry | null,
  payload: Record<string, unknown>,
  label: string
): Promise<UpsertResult> => {
  const payloadHash = hashPayload(payload);

  if (existing && existing.payloadHash === payloadHash) {
    console.log(`= ${label} unchanged`);
    return { entry: existing, changed: false };
  }

  const rkey = existing?.rkey ?? nextTid();
  const verb = existing ? 'update' : 'create';

  if (dryRun) {
    console.log(`~ ${label} would ${verb} ${collection}/${rkey}:`);
    console.log(JSON.stringify(payload, null, 2));
    return { entry: { rkey, payloadHash }, changed: true };
  }

  if (!session) {
    throw new Error('no session outside --dry-run');
  }

  const uri = await putRecord(session, collection, rkey, payload);
  console.log(`${existing ? '~' : '+'} ${label} -> ${uri}`);

  return { entry: { rkey, payloadHash }, changed: true };
};

const main = async (): Promise<void> => {
  const registry = await loadRegistry();
  const config = dryRun ? null : loadConfig();
  const session = config
    ? await createSession(config.pdsUrl, config.identifier, config.appPassword)
    : null;

  // `--dry-run` still wants a realistic `at://` URI to print; reuse the
  // DID already on record, falling back to a placeholder before the very
  // first publish, since there is no session to ask.
  const did = session?.did ?? registry.did ?? 'did:plc:dry-run';

  const publication = await upsert(
    session,
    PUBLICATION_COLLECTION,
    registry.publication,
    buildPublication(),
    'publication'
  );
  const siteUri = atUri(did, PUBLICATION_COLLECTION, publication.entry.rkey);

  const posts = (await discoverPosts()).filter((post) => !post.metadata.draft);
  const documents: RecordsRegistry['documents'] = {};

  for (const post of posts) {
    if (post.sourceMarkdown === null) {
      console.warn(
        `! ${post.slug} has no source note in src/lib/posts/sources/; textContent falls back to its description`
      );
    }

    const textContent =
      post.sourceMarkdown !== null ? toTextContent(post.sourceMarkdown) : post.metadata.description;

    const payload = buildDocument({
      siteUri,
      title: post.metadata.title,
      publishedAt: post.metadata.date,
      path: `/blog/${post.slug}`,
      description: post.metadata.description,
      textContent,
      tags: post.metadata.tags
    });

    const result = await upsert(
      session,
      DOCUMENT_COLLECTION,
      registry.documents[post.slug] ?? null,
      payload,
      `post/${post.slug}`
    );

    documents[post.slug] = result.entry;
  }

  // Anything left in the registry has no matching published post anymore:
  // delete it from the PDS and drop it from the registry.
  for (const [slug, entry] of Object.entries(registry.documents)) {
    if (documents[slug]) {
      continue;
    }

    if (dryRun) {
      console.log(`- post/${slug} would be deleted (${DOCUMENT_COLLECTION}/${entry.rkey})`);
      continue;
    }

    if (!session) {
      throw new Error('no session outside --dry-run');
    }

    await deleteRecord(session, DOCUMENT_COLLECTION, entry.rkey);
    console.log(`- post/${slug} deleted`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was written.');
    return;
  }

  await saveRegistry({ did, publication: publication.entry, documents });
  console.log(`\nrecords.json updated. Site: ${SITE_URL}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
