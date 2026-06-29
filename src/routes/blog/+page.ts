import { posts } from '$lib/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	return { posts };
};
