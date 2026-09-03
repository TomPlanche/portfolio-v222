// Discovery endpoint for the publication record: the `at://` URI other
// ATmosphere readers resolve to find this blog's `site.standard.publication`.
//
// The response format (plain text vs JSON) is not confirmed against
// standard.site's actual convention -- this follows the common
// `.well-known` idiom of a bare value in `text/plain` (as with
// `.well-known/atproto-did`). Verify against https://site-validator.fly.dev
// after the first real deploy and adjust if it expects JSON instead.

import { error, text } from '@sveltejs/kit';
import { atUri, type RecordsRegistry } from '$lib/atproto/records';
import recordsJson from '$lib/atproto/records.json';
import type { RequestHandler } from './$types';

const records = recordsJson as RecordsRegistry;

export const GET: RequestHandler = () => {
  if (!records.did || !records.publication) {
    error(404, 'no site.standard.publication record has been published yet');
  }

  return text(atUri(records.did, 'site.standard.publication', records.publication.rkey));
};
