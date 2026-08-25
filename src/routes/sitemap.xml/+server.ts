// Sitemap.
//
// Generated per request rather than prerendered: `adapter-node` serves the
// site from whatever origin the `ORIGIN` environment variable declares, and
// every `<loc>` has to be absolute, so the origin is only known at runtime.

import { posts } from '$lib/posts';
import commits from '../../../static/website_infos.json';
import type { RequestHandler } from './$types';

type Entry = {
  path: string;
  /** ISO date, trimmed to `YYYY-MM-DD`. */
  lastmod?: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
};

/** Date of the last commit, standing in for "when did this page last change". */
const lastDeploy = commits[0]?.commit.committer.date.slice(0, 10);

const entries = (): Entry[] => [
  { path: '/', lastmod: lastDeploy, changefreq: 'monthly', priority: '1.0' },
  { path: '/blog', lastmod: posts[0]?.date ?? lastDeploy, changefreq: 'weekly', priority: '0.8' },
  ...posts.map((post): Entry => ({
    path: `/blog/${post.slug}`,
    lastmod: post.date,
    changefreq: 'yearly',
    priority: '0.6'
  }))
];

const toUrl = (origin: string, entry: Entry): string =>
  [
    '  <url>',
    `    <loc>${origin}${entry.path}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>'
  ]
    .filter((line) => line !== null)
    .join('\n');

export const GET: RequestHandler = ({ url }) => {
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries().map((entry) => toUrl(url.origin, entry)),
    '</urlset>',
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'application/xml',
      'cache-control': 'public, max-age=0, s-maxage=3600'
    }
  });
};
