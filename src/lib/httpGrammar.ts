// A minimal TextMate grammar for HTTP request and response lines.
//
// Shiki ships an `http` grammar, but it embeds shellscript, xml, graphql and
// json to colour request bodies, which drags in ~61 kB gzipped. Blog posts here
// only ever show a request line, a status line and the odd header, so this
// hand-written grammar covers the same ground for about a kilobyte.
//
// If a post ever needs a full request with a highlighted body, delete this file
// and point `http` at `@shikijs/langs/http` in `$lib/highlight`.
//
// The scope names are what matter: Shiki's "CSS variables" theme colours a
// token by its scope, so `keyword.control` picks up `--code-token-keyword` and
// so on. `meta.*` scopes are unstyled, which leaves them at the foreground
// colour on purpose.

import type { LanguageRegistration } from 'shiki/core';

const METHODS = 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT';

export const http: LanguageRegistration = {
  name: 'http',
  scopeName: 'source.http',
  patterns: [
    // A whole-line comment, the way one annotates a captured request.
    {
      match: '^\\s*#.*$',
      name: 'comment.line.number-sign.http'
    },

    // Request line: `GET /bookings/user/:id?category=ondemand HTTP/1.1`.
    // The version is optional, since posts usually leave it off.
    {
      match: `^\\s*(${METHODS})\\s+([^\\s?]*)(\\?\\S*)?(?:\\s+(HTTP/[\\d.]+))?\\s*$`,
      captures: {
        1: { name: 'keyword.control.verb.http' },
        2: { patterns: [{ include: '#path' }] },
        3: { patterns: [{ include: '#query' }] },
        4: { name: 'constant.language.version.http' }
      }
    },

    // Status line: `HTTP/1.1 409 Conflict`.
    {
      match: '^\\s*(HTTP/[\\d.]+)\\s+(\\d{3})(\\s+.*)?$',
      captures: {
        1: { name: 'constant.language.version.http' },
        2: { name: 'constant.numeric.status.http' },
        3: { name: 'string.unquoted.reason.http' }
      }
    },

    // Header: `Authorization: <token>`.
    {
      match: '^\\s*([A-Za-z][A-Za-z0-9-]*)(:)([ \\t]*.*)$',
      captures: {
        1: { name: 'entity.name.tag.header.http' },
        2: { name: 'punctuation.separator.http' },
        3: { name: 'string.unquoted.value.http' }
      }
    }
  ],
  repository: {
    // The path stays at the foreground colour, since it is the part a reader is
    // meant to read rather than a token to decorate. Only a `:param` placeholder
    // is picked out. The catch-all stops before a colon so the placeholder
    // pattern gets a chance to match: TextMate takes the leftmost match, and a
    // greedy catch-all would otherwise swallow the whole path first.
    path: {
      patterns: [
        { match: '(:)([A-Za-z_][A-Za-z0-9_]*)', name: 'variable.parameter.function.http' },
        { match: '[^\\s:]+', name: 'meta.path.http' }
      ]
    },
    query: {
      patterns: [
        { match: '[?&]', name: 'punctuation.separator.http' },
        { match: '[^=&?]+(?==)', name: 'entity.other.attribute-name.http' },
        { match: '=', name: 'punctuation.separator.http' },
        { match: '[^&]+', name: 'string.unquoted.http' }
      ]
    }
  }
};

export default [http];
