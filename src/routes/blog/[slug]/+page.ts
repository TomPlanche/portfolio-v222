import { error } from '@sveltejs/kit';
import { getPost } from '$lib/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  const post = getPost(params.slug);

  if (!post) {
    error(404, `Post "${params.slug}" not found`);
  }

  return {
    component: post.default,
    metadata: post.metadata,
    seo: {
      title: post.metadata.title,
      description: post.metadata.description,
      type: 'article' as const,
      publishedAt: post.metadata.date
    }
  };
};
