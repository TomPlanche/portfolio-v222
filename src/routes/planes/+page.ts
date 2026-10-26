import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  return {
    seo: {
      title: 'planes',
      description: 'Planes crossing the sky in ASCII, seen from above.'
    }
  };
};
