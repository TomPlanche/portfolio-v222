# ATProto publishing

Publishes the blog to ATProto as [standard.site](https://standard.site) records: one `site.standard.publication` for the blog itself, and one `site.standard.document` per published post. `standard.site` is not a service, just a shared pair of lexicons -- this writes them straight into this account's own PDS repo, so ATmosphere readers (Leaflet, pckt, Offprint, Sifa ID, Frontpage...) can find the blog without scraping it.

## Usage

```sh
pnpm blog:publish-atproto              # publish for real
pnpm blog:publish-atproto -- --dry-run # print what would change, write nothing, no network calls
```

`--dry-run` never authenticates, so it works without any of the environment variables below.

## Environment

Set these in `.env` locally (`node --env-file-if-exists=.env` loads it, same as the `serve` script), or in the real environment in CI/production.

| Variable               | Required | Notes                                                                                                    |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `ATPROTO_PDS_URL`      | yes      | The PDS this account lives on, e.g. `https://bsky.social`.                                               |
| `ATPROTO_IDENTIFIER`   | yes      | The account's handle or DID.                                                                             |
| `ATPROTO_APP_PASSWORD` | yes      | An [app password](https://bsky.app/settings/app-passwords), not the account password. Never commit this. |

## How it works

- `src/lib/atproto/records.json` is the committed registry mapping each post's slug (and the publication) to the record key (a TID) it was written under, plus a hash of the last payload written. It is what makes `putRecord` idempotent across runs: a TID is minted once, at first publish, and reused after that; an unchanged post is skipped rather than rewritten.
- Post metadata (title, date, description, tags) comes from each post's own `PostMetadata` export in `src/lib/posts/*.svelte` -- the same values the live site renders -- not from re-parsing the source note, so there's no fallback logic to duplicate.
- `textContent` comes from the post's source note in `src/lib/posts/sources/<slug>.md`, reduced to plain text (see `textContent.ts`). A post with no source note (see `src/lib/posts/README.md`: not every post starts from one) falls back to its `description`.
- A post no longer published (removed, or turned into a draft) has its record deleted and its entry dropped from the registry on the next publish.
- `src/lib/atproto/records.json` is read directly by the SvelteKit app too (the `.well-known/site.standard.publication` endpoint and the per-post `<link rel="site.standard.document">` tag), so a publish only takes effect on the live site after the next deploy.

## After the first real deploy

These aren't automated -- check them by hand once records exist:

- **The PDS must be crawled**, or the records exist but nothing ever indexes them. Confirm the PDS is asking a relay (`bsky.network` by default) to crawl it.
- Inspect the written records at [pdsls.dev](https://pdsls.dev).
- Validate against [site-validator.fly.dev](https://site-validator.fly.dev).
- Check `sifa.id/p/<handle>` shows a "Publications" section with the right post count and links.
