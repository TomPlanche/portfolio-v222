import { error } from '@sveltejs/kit';
import { getPost } from '$lib/posts';
import { atUri, type RecordsRegistry } from '$lib/atproto/records';
import recordsJson from '$lib/atproto/records.json';
import type { PageLoad } from './$types';

// Cast rather than relying on the JSON import's inferred literal type,
// which would otherwise narrow `documents` to whatever slugs happen to
// be in the file right now instead of the general `RecordsRegistry` shape.
const records = recordsJson as RecordsRegistry;

export const load: PageLoad = ({ params }) => {
  const post = getPost(params.slug);

  if (!post) {
    error(404, `Post "${params.slug}" not found`);
  }

  const document = records.documents[params.slug];

  return {
    component: post.default,
    metadata: post.metadata,
    seo: {
      title: post.metadata.title,
      description: post.metadata.description,
      type: 'article' as const,
      publishedAt: post.metadata.date,
      atUri:
        records.did && document
          ? atUri(records.did, 'site.standard.document', document.rkey)
          : undefined
    }
  };
};
