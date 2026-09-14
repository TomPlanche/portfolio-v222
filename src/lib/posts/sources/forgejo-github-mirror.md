+++
date = "2026-09-14"
description = "How I made my self-hosted Forgejo the main home for my GitHub forks and personal repos, why a simple two-way mirror kept destroying itself, and every failure along the way, including one closed pull request and one outage I caused myself."
tags = ["self-hosting", "forgejo", "git", "rust", "automation"]
title = "I made my Forgejo the source of truth, and it broke three times"
slug = "forgejo-github-mirror"
+++

I run a self-hosted Forgejo instance at `git.tomplanche.com`. It runs on a Raspberry Pi behind a Hetzner VPS. I wanted to use it for real work, not as a copy next to GitHub. I wanted to clone from it, push to it, and do all my work there.

GitHub still matters to me. A contribution to an open-source project needs a pull request, and a pull request must live on GitHub.

So I needed both systems. GitHub is where I open pull requests. Forgejo is where I do the work. This post explains how I connected the two, and the three times I broke something in the process.

## The naive first version

My first idea was simple. Mirror my GitHub fork to Forgejo, and mirror Forgejo back to the same fork. Pull from `tomplanche/zed` into `tom/zed`. Push from `tom/zed` back into `tomplanche/zed`.

This works until the fork's `main` branch needs to track upstream. For years my habit has been this command:

```bash name=syncFork
git switch main && git fetch upstream && git reset --hard upstream/main && git push origin main
```

That command fights with a fork that Forgejo also mirrors. Forgejo pulls whatever is on the fork, then pushes it straight back. Any change I made only on the Forgejo side disappears the next time I run this command. At one point this deleted a small fix for broken README images (more on that later). Two systems cannot both own the same branch. They erase each other instead.

<img src="/diagrams/forgejo-github-mirror/naive-vs-directed.svg" alt="Two diagrams stacked. Top: the naive setup, where GitHub repo B and Forgejo repo C mirror each other in both directions. Bottom: the directed setup, where upstream A pulls into C, and C pushes into B." style="display: block; margin: 1.5rem auto; max-width: 70%; height: auto;" />

<p><em>Left: the naive setup, one repo mirrored both ways. Right: three repos, one direction each way.</em></p>

## Naming the three repos

The fix was simple. Admit there are three repos, not two, and give the sync a direction.

- **A**, the real upstream, for example `zed-industries/zed`. This exists only when I forked something.
- **B**, my copy on GitHub, for example `tomplanche/zed`. This is either a fork of A, or, for my own projects, just my repo with no upstream.
- **C**, the mirror on my own Forgejo, for example `tom/zed`.

The sync moves in one direction each way.

- **Pull mirror, A to C.** Forgejo pulls straight from upstream, not from my fork. Upstream changes reach Forgejo without me touching B.
- **Push mirror, C to B.** Any change I make on Forgejo, on any branch, reaches my GitHub repo automatically and fast. Forgejo mirrors support a `sync_on_commit` flag for this. B becomes a passive target. Its only job is to exist on GitHub, so I can open a pull request from it.

<img src="/diagrams/forgejo-github-mirror/architecture.svg" alt="Diagram of the full setup: upstream A pulls into Forgejo mirror C, C pushes into GitHub repo B, the author works only on C, and B is used to open a pull request against A." style="display: block; margin: 1.5rem auto; max-width: 100%; height: auto;" />

I now do all my work on C. I never touch B by hand again. My old `git reset --hard upstream/main` habit is no longer needed, because the pull mirror already keeps C's `main` branch in sync with A.

For my own repos, there is no A. The pull mirror points at B directly. The same repo sits on both ends, which works because I am the only source for those repos.

This distinction was harder to compute than I expected. I wrote a script to bulk-import all my forks. It called GitHub's `GET /users/{username}/repos?type=forks` endpoint. Every one of my own original repos came back labeled "Fork of `github.com/tomplanche/whatever`", a fork of myself that does not exist. The `type=forks` filter is not real. GitHub ignores it and accepts only `all`, `owner`, or `member`. The real signal is a boolean field on each repo, called `fork`. By the time I noticed, twenty-two already-migrated repos carried this wrong label. I had to fix them after the fact.

## Building a proper tool for it

I started with a bash script. It listed my repos, called Forgejo's `/repos/migrate` endpoint for the pull mirror, and called `/repos/{owner}/{repo}/push_mirrors` for the push side. It worked for a while.

A shell script that migrates dozens of repos needs a dry run and a way to pick a subset. Mine had neither, so I did not trust it. I rewrote it as `forgejo-sync`, a small command-line tool in Rust.

The tool fetches every repo first. It lets me filter by `--forks`, `--owned`, or `--all`. It shows an interactive checklist so I can narrow the list further. It prints a full plan before it touches anything. Only after I confirm the plan does it sync, one repo at a time.

`forgejo-sync` now lives as its own repository. My Forgejo customization repo pulls it in as a git submodule, since the tool is reusable and not tied to one migration.

## Everything that went wrong

### Broken images

The first problem appeared right after I migrated a fork. Its README showed a broken image.

GitHub's own renderer rewrites `github.com/.../blob/...` image links to raw content before it shows them. This makes a broken link look correct on github.com. Forgejo does not do this rewrite for an external URL, so the same link renders broken there.

This was not a bug in the migration. It was a difference between two renderers handling a link that was always wrong.

### Actions firing on every sync

Once the push mirror went live, GitHub Actions started running on forks I had not touched in weeks.

The push mirror's `sync_on_commit` setting fires on any change on the Forgejo side. This includes a change that came from the pull mirror itself. Upstream gets a commit, my pull mirror picks it up, and that triggers the push mirror. GitHub then sees a push and runs any workflow still enabled on the fork, as if I had pushed it myself.

Eleven of my twelve forks still had Actions enabled from when I first forked them. I disabled Actions on all of them. A fork's only job now is to host code for a pull request, not to run CI.

### The one that actually hurt

This failure hurt the most. Forgejo's pull mirror has a setting called Prune, on by default. Prune deletes any branch on the Forgejo side that is missing from the pull source.

A push mirror sends every change to GitHub. Combine that with Prune. A branch that only ever existed on Forgejo, for example a feature branch for a real contribution, gets deleted on the next routine sync. Forgejo then mirrors that deletion to GitHub. GitHub reacts to a missing source branch by closing the pull request that used it.

This happened to me on a real pull request, one I wanted merged upstream. I restored the branch by hand and reopened the pull request.

There is no REST API for the Prune setting. I checked Forgejo's own published API schema, and Prune is not in it. Only the web UI can change it: go to a repo's mirror settings and clear the checkbox marked "Remove obsolete remote-tracking references".

A tool cannot verify this setting for you. It cannot even ask "did you already do this" in a way you can answer. The repo did not exist a minute before the question. `forgejo-sync` now prints a direct link to that settings page after every sync, as a standing reminder.

### Losing two repos to a ten-minute clock

I tried to migrate two large repos, `zed` and `typst-packages`. Both failed with a client timeout.

The web UI showed each repo stuck on "migrating...". Later, the repo was simply gone. Forgejo's migrate endpoint has its own server-side clone timeout: `[git.timeout] MIGRATE` in `app.ini`, set to 600 seconds by default. When a clone runs past this limit, Forgejo does not just fail the request. It deletes the partly migrated repo. Ten minutes is not enough time for a repo the size of `zed`.

I raised the limit to one hour. I set it through the `FORGEJO__git.timeout__MIGRATE` environment variable in my compose file. This keeps the setting in git, not as a manual edit on the server. I raised `MIRROR` the same way, so a later resync of a big repo does not hit the same wall.

### The outage I caused fixing the outage

Finding the timeout meant working on the Pi directly. I backed up `app.ini` with `docker compose exec`, edited it, then restored the backup once I moved the real fix into the compose file.

The backup and restore both ran as the container's default user, root, not as `git`, the user Forgejo actually runs as. Copying a file as root changes who owns it. The restored `app.ini` ended up owned by root, and the `git` user could no longer read it.

The whole instance crash-looped on startup. It failed again and again with "permission denied" reading its own config. I fixed this with a `chown` back to the correct user. I ran the command on the host file system directly, since the container restarted too fast for a reliable connection.

Copying a file back is not a neutral action once more than one user is involved.

## Where it landed

The setup today: pull from upstream, push to the fork, all work happens on Forgejo. Prune is off everywhere. GitHub Actions are off on every fork. Timeouts are raised for the big repos. A small Rust tool refuses to touch anything until I have seen the full plan and said yes.

None of this is unusual. Most of it came from learning, the hard way, which Forgejo defaults assume a passive mirror. Those same defaults stop being safe the moment you treat Forgejo as the place you actually work.
