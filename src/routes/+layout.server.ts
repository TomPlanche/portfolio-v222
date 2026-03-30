import { env } from '$env/dynamic/private';

type CommitInfo = {
	sha: string;
	date: string;
	url: string;
};

export const load = async (): Promise<{ lastCommit: CommitInfo | null }> => {
	try {
		console.log('trying to fetch last commit with token:');
		const response = await fetch(
			'https://api.github.com/repos/TomPlanche/portfolio-v222/commits?per_page=1',
			{
				headers: {
					Authorization: `Bearer ${env.GITHUB_TOKEN}`,
					Accept: 'application/vnd.github.v3+json'
				}
			}
		);

		if (!response.ok) {
			console.error(response.statusText);

			return { lastCommit: null };
		}

		const commits = (await response.json()) as Array<{
			sha: string;
			html_url: string;
			commit: {
				committer: { date: string };
			};
		}>;

		const commit = commits[0];

		return {
			lastCommit: {
				sha: commit.sha.slice(0, 7),
				date: commit.commit.committer.date,
				url: commit.html_url
			}
		};
	} catch (error) {
		console.error('Error fetching last commit:', error);

		return { lastCommit: null };
	}
};
