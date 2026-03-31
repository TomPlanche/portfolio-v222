import commits from '../../static/website_infos.json';

type CommitInfo = {
	sha: string;
	date: string;
	url: string;
};

export const load = (): { lastCommit: CommitInfo | null } => {
	const commit = commits[0];

	if (!commit) return { lastCommit: null };

	return {
		lastCommit: {
			sha: commit.sha.slice(0, 7),
			date: commit.commit.committer.date,
			url: commit.html_url
		}
	};
};
