import commits from '../../static/website_infos.json';

import { getMaintenance, type Maintenance } from '$lib/server/maintenance';

type CommitInfo = {
  sha: string;
  date: string;
  url: string;
};

export const load = (): { lastCommit: CommitInfo | null; maintenance: Maintenance | null } => {
  const maintenance = getMaintenance();
  const commit = commits[0];

  if (!commit) {
    return { lastCommit: null, maintenance };
  }

  return {
    lastCommit: {
      sha: commit.sha.slice(0, 7),
      date: commit.commit.committer.date,
      url: commit.html_url
    },
    maintenance
  };
};
