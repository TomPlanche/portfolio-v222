import { loadActivityCalendar } from '$lib/server/activityCalendar';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {
    activity: await loadActivityCalendar(),
    seo: {
      title: 'activity',
      description: 'A calendar of the public activity of Tom Planche, one square per day.'
    }
  };
};
