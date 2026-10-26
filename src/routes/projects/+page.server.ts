import { loadRecentActivity } from '$lib/server/githubActivity';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {
    activity: await loadRecentActivity(),
    seo: {
      title: 'projects',
      description: 'Projects and recent GitHub activity by Tom Planche.'
    }
  };
};
