// Builds the exact JSON written to the PDS for the two `site.standard.*`
// record types this blog uses. No package implements these lexicons (see
// `client.ts`); the shapes below are transcribed from the lexicon
// definitions themselves.

export const SITE_URL = 'https://tomplanche.com';
const SITE_NAME = 'Tom Planche';

export type PublicationRecord = {
  $type: 'site.standard.publication';
  url: string;
  name: string;
};

export const buildPublication = (): PublicationRecord => ({
  $type: 'site.standard.publication',
  url: SITE_URL,
  name: SITE_NAME
});

export type DocumentRecord = {
  $type: 'site.standard.document';
  site: string;
  title: string;
  publishedAt: string;
  path?: string;
  description?: string;
  textContent?: string;
  tags?: string[];
};

/** ATProto's `datetime` format: RFC 3339, explicit offset, milliseconds. `Date#toISOString` already produces exactly this. */
const toRfc3339 = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`not a valid date: ${isoDate}`);
  }

  return date.toISOString();
};

export type DocumentInput = {
  siteUri: string;
  title: string;
  /** The post's `YYYY-MM-DD` date, as carried in `PostMetadata`. */
  publishedAt: string;
  path: string;
  description?: string;
  textContent?: string;
  tags?: string[];
};

export const buildDocument = (input: DocumentInput): DocumentRecord => ({
  $type: 'site.standard.document',
  site: input.siteUri,
  title: input.title,
  publishedAt: toRfc3339(input.publishedAt),
  path: input.path,
  ...(input.description ? { description: input.description } : {}),
  ...(input.textContent ? { textContent: input.textContent } : {}),
  ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {})
});
