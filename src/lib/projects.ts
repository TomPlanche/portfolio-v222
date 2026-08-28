// The projects listed on the home page. `projects.json` holds the data so it
// can be edited without touching a component; this module gives it a type and
// a single import path, the way `$lib/posts` does for the blog.

import data from './projects.json';

export type Project = {
  name: string;
  role: 'author' | 'contributor';
  url: string;
  description: string;
  language: string;
  /** An image path, or the literal `globe` for the interactive one. */
  medium?: string;
  /** Percentages, applied to the image inside the card. */
  maxWidth?: number;
  maxHeight?: number;
};

export const projects = data as Project[];
