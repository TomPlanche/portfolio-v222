// Thin wrapper over `@atcute/client` for the three XRPC calls the publish
// script needs: session creation, and reading/writing records via
// `com.atproto.repo.*`. No package implements the `site.standard.*`
// lexicons, and none is needed for two record types -- `putRecord`'s
// `record` field is untyped JSON, so writing them is just building the
// right plain object and calling `putRecord`.

import { Client, simpleFetchHandler } from '@atcute/client';
import '@atcute/atproto';
import { type Did, isDid, type Nsid } from '@atcute/lexicons/syntax';

export type Session = {
  client: Client;
  did: Did;
};

const errorMessage = (
  call: string,
  res: { status: number; data: { error: string; message?: string } }
): string =>
  `${call} failed (${res.status}): ${res.data.error}${res.data.message ? `: ${res.data.message}` : ''}`;

/** Authenticates with an app password and returns a session whose client sends the access token on every request. */
export const createSession = async (
  pdsUrl: string,
  identifier: string,
  password: string
): Promise<Session> => {
  const anonymous = new Client({ handler: simpleFetchHandler({ service: pdsUrl }) });

  const res = await anonymous.post('com.atproto.server.createSession', {
    input: { identifier, password }
  });

  if (!res.ok) {
    throw new Error(errorMessage('com.atproto.server.createSession', res));
  }

  const { accessJwt, did } = res.data;

  if (!isDid(did)) {
    throw new Error(`createSession returned a DID that doesn't look like one: ${did}`);
  }

  const base = simpleFetchHandler({ service: pdsUrl });
  const client = new Client({
    handler: (pathname: string, init: RequestInit) => {
      // `init.headers` is a real `Headers` instance here (the library
      // builds it with `new Headers(...)`), not a plain object -- its
      // entries aren't own-enumerable properties, so `{ ...init.headers }`
      // silently drops them all, `content-type` included. Use the `Headers`
      // API to merge instead.
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${accessJwt}`);

      return base(pathname, { ...init, headers });
    }
  });

  return { client, did };
};

/** Upserts a record (`com.atproto.repo.putRecord` is idempotent) and returns its `at://` URI. */
export const putRecord = async (
  { client, did }: Session,
  collection: Nsid,
  rkey: string,
  record: Record<string, unknown>
): Promise<string> => {
  const res = await client.post('com.atproto.repo.putRecord', {
    input: { repo: did, collection, rkey, record }
  });

  if (!res.ok) {
    throw new Error(errorMessage(`putRecord ${collection}/${rkey}`, res));
  }

  return res.data.uri;
};

export const deleteRecord = async (
  { client, did }: Session,
  collection: Nsid,
  rkey: string
): Promise<void> => {
  const res = await client.post('com.atproto.repo.deleteRecord', {
    input: { repo: did, collection, rkey }
  });

  if (!res.ok) {
    throw new Error(errorMessage(`deleteRecord ${collection}/${rkey}`, res));
  }
};
