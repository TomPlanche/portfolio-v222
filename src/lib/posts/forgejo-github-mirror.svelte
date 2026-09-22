<script module lang="ts">
  import type { PostMetadata } from '$lib/posts';

  export const metadata: PostMetadata = {
    title: 'I made my Forgejo the source of truth, and it broke three times',
    date: '2026-09-14',
    description:
      'How I made my self-hosted Forgejo the main home for my GitHub forks and personal repos, why a simple two-way mirror kept destroying itself, and every failure along the way, including one closed pull request and one outage I caused myself.',
    tags: ['self-hosting', 'forgejo', 'git', 'rust', 'automation'],
    draft: true
  };
</script>

<script lang="ts">
  import Code from '$lib/components/Code.svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte';

  const syncFork = `
    git switch main && git fetch upstream && git reset --hard upstream/main && git push origin main
  `;
</script>

<p>
  I run a self-hosted Forgejo instance at <Code>git.tomplanche.com</Code>. It runs on a Raspberry Pi
  behind a Hetzner VPS. I wanted to use it for real work, not as a copy next to GitHub. I wanted to
  clone from it, push to it, and do all my work there.
</p>

<p>
  GitHub still matters to me. A contribution to an open-source project needs a pull request, and a
  pull request must live on GitHub.
</p>

<p>
  So I needed both systems. GitHub is where I open pull requests. Forgejo is where I do the work.
  This post explains how I connected the two, and the three times I broke something in the process.
</p>

<h2>The naive first version</h2>

<p>
  My first idea was simple. Mirror my GitHub fork to Forgejo, and mirror Forgejo back to the same
  fork. Pull from <Code>tomplanche/zed</Code> into <Code>tom/zed</Code>. Push from <Code
    >tom/zed</Code
  > back into <Code>tomplanche/zed</Code>.
</p>

<p>
  This works until the fork's <Code>main</Code> branch needs to track upstream. For years my habit has
  been this command:
</p>

<CodeBlock code={syncFork} lang="bash" />

<p>
  That command fights with a fork that Forgejo also mirrors. Forgejo pulls whatever is on the fork,
  then pushes it straight back. Any change I made only on the Forgejo side disappears the next time
  I run this command. At one point this deleted a small fix for broken README images (more on that
  later). Two systems cannot both own the same branch. They erase each other instead.
</p>

<img
  src="/diagrams/forgejo-github-mirror/naive-vs-directed.svg"
  alt="Two diagrams stacked. Top: the naive setup, where GitHub repo B and Forgejo repo C mirror each other in both directions. Bottom: the directed setup, where upstream A pulls into C, and C pushes into B."
  style="display: block; margin: 1.5rem auto; max-width: 70%; height: auto;"
/>

<p>
  <em
    >Left: the naive setup, one repo mirrored both ways. Right: three repos, one direction each way.</em
  >
</p>

<h2>Naming the three repos</h2>

<p>The fix was simple. Admit there are three repos, not two, and give the sync a direction.</p>

<ul>
  <li>
    <strong>A</strong>, the real upstream, for example <Code>zed-industries/zed</Code>. This exists
    only when I forked something.
  </li>
  <li>
    <strong>B</strong>, my copy on GitHub, for example <Code>tomplanche/zed</Code>. This is either a
    fork of A, or, for my own projects, just my repo with no upstream.
  </li>
  <li><strong>C</strong>, the mirror on my own Forgejo, for example <Code>tom/zed</Code>.</li>
</ul>

<p>The sync moves in one direction each way.</p>

<ul>
  <li>
    <strong>Pull mirror, A to C.</strong> Forgejo pulls straight from upstream, not from my fork. Upstream
    changes reach Forgejo without me touching B.
  </li>
  <li>
    <strong>Push mirror, C to B.</strong> Any change I make on Forgejo, on any branch, reaches my
    GitHub repo automatically and fast. Forgejo mirrors support a <Code>sync_on_commit</Code> flag for
    this. B becomes a passive target. Its only job is to exist on GitHub, so I can open a pull request
    from it.
  </li>
</ul>

<img
  src="/diagrams/forgejo-github-mirror/architecture.svg"
  alt="Diagram of the full setup: upstream A pulls into Forgejo mirror C, C pushes into GitHub repo B, the author works only on C, and B is used to open a pull request against A."
  style="display: block; margin: 1.5rem auto; max-width: 100%; height: auto;"
/>

<p>
  I now do all my work on C. I never touch B by hand again. My old <Code
    >git reset --hard upstream/main</Code
  > habit is no longer needed, because the pull mirror already keeps C's <Code>main</Code> branch in sync
  with A.
</p>

<p>
  For my own repos, there is no A. The pull mirror points at B directly. The same repo sits on both
  ends, which works because I am the only source for those repos.
</p>

<p>
  This distinction was harder to compute than I expected. I wrote a script to bulk-import all my
  forks. It called GitHub's <Code>GET /users/&#123;username&#125;/repos?type=forks</Code> endpoint. Every
  one of my own original repos came back labeled "Fork of <Code>github.com/tomplanche/whatever</Code
  >", a fork of myself that does not exist. The <Code>type=forks</Code> filter is not real. GitHub ignores
  it and accepts only <Code>all</Code>, <Code>owner</Code>, or <Code>member</Code>. The real signal
  is a boolean field on each repo, called <Code>fork</Code>. By the time I noticed, twenty-two
  already-migrated repos carried this wrong label. I had to fix them after the fact.
</p>

<h2>Building a proper tool for it</h2>

<p>
  I started with a bash script. It listed my repos, called Forgejo's <Code>/repos/migrate</Code> endpoint
  for the pull mirror, and called <Code>/repos/&#123;owner&#125;/&#123;repo&#125;/push_mirrors</Code
  > for the push side. It worked for a while.
</p>

<p>
  A shell script that migrates dozens of repos needs a dry run and a way to pick a subset. Mine had
  neither, so I did not trust it. I rewrote it as <Code>forgejo-sync</Code>, a small command-line
  tool in Rust.
</p>

<p>
  The tool fetches every repo first. It lets me filter by <Code>--forks</Code>, <Code>--owned</Code
  >, or <Code>--all</Code>. It shows an interactive checklist so I can narrow the list further. It
  prints a full plan before it touches anything. Only after I confirm the plan does it sync, one
  repo at a time.
</p>

<p>
  <Code>forgejo-sync</Code> now lives as its own repository. My Forgejo customization repo pulls it in
  as a git submodule, since the tool is reusable and not tied to one migration.
</p>

<h2>Everything that went wrong</h2>

<h3>Broken images</h3>

<p>The first problem appeared right after I migrated a fork. Its README showed a broken image.</p>

<p>
  GitHub's own renderer rewrites <Code>github.com/.../blob/...</Code> image links to raw content before
  it shows them. This makes a broken link look correct on github.com. Forgejo does not do this rewrite
  for an external URL, so the same link renders broken there.
</p>

<p>
  This was not a bug in the migration. It was a difference between two renderers handling a link
  that was always wrong.
</p>

<h3>Actions firing on every sync</h3>

<p>
  Once the push mirror went live, GitHub Actions started running on forks I had not touched in
  weeks.
</p>

<p>
  The push mirror's <Code>sync_on_commit</Code> setting fires on any change on the Forgejo side. This
  includes a change that came from the pull mirror itself. Upstream gets a commit, my pull mirror picks
  it up, and that triggers the push mirror. GitHub then sees a push and runs any workflow still enabled
  on the fork, as if I had pushed it myself.
</p>

<p>
  Eleven of my twelve forks still had Actions enabled from when I first forked them. I disabled
  Actions on all of them. A fork's only job now is to host code for a pull request, not to run CI.
</p>

<h3>The one that actually hurt</h3>

<p>
  This failure hurt the most. Forgejo's pull mirror has a setting called Prune, on by default. Prune
  deletes any branch on the Forgejo side that is missing from the pull source.
</p>

<p>
  A push mirror sends every change to GitHub. Combine that with Prune. A branch that only ever
  existed on Forgejo, for example a feature branch for a real contribution, gets deleted on the next
  routine sync. Forgejo then mirrors that deletion to GitHub. GitHub reacts to a missing source
  branch by closing the pull request that used it.
</p>

<p>
  This happened to me on a real pull request, one I wanted merged upstream. I restored the branch by
  hand and reopened the pull request.
</p>

<p>
  There is no REST API for the Prune setting. I checked Forgejo's own published API schema, and
  Prune is not in it. Only the web UI can change it: go to a repo's mirror settings and clear the
  checkbox marked "Remove obsolete remote-tracking references".
</p>

<p>
  A tool cannot verify this setting for you. It cannot even ask "did you already do this" in a way
  you can answer. The repo did not exist a minute before the question. <Code>forgejo-sync</Code> now prints
  a direct link to that settings page after every sync, as a standing reminder.
</p>

<h3>Losing two repos to a ten-minute clock</h3>

<p>
  I tried to migrate two large repos, <Code>zed</Code> and <Code>typst-packages</Code>. Both failed
  with a client timeout.
</p>

<p>
  The web UI showed each repo stuck on "migrating...". Later, the repo was simply gone. Forgejo's
  migrate endpoint has its own server-side clone timeout: <Code>[git.timeout] MIGRATE</Code> in <Code
    >app.ini</Code
  >, set to 600 seconds by default. When a clone runs past this limit, Forgejo does not just fail
  the request. It deletes the partly migrated repo. Ten minutes is not enough time for a repo the
  size of <Code>zed</Code>.
</p>

<p>
  I raised the limit to one hour. I set it through the <Code>FORGEJO__git.timeout__MIGRATE</Code> environment
  variable in my compose file. This keeps the setting in git, not as a manual edit on the server. I raised
  <Code>MIRROR</Code> the same way, so a later resync of a big repo does not hit the same wall.
</p>

<h3>The outage I caused fixing the outage</h3>

<p>
  Finding the timeout meant working on the Pi directly. I backed up <Code>app.ini</Code> with <Code
    >docker compose exec</Code
  >, edited it, then restored the backup once I moved the real fix into the compose file.
</p>

<p>
  The backup and restore both ran as the container's default user, root, not as <Code>git</Code>,
  the user Forgejo actually runs as. Copying a file as root changes who owns it. The restored <Code
    >app.ini</Code
  > ended up owned by root, and the <Code>git</Code> user could no longer read it.
</p>

<p>
  The whole instance crash-looped on startup. It failed again and again with "permission denied"
  reading its own config. I fixed this with a <Code>chown</Code> back to the correct user. I ran the command
  on the host file system directly, since the container restarted too fast for a reliable connection.
</p>

<p>Copying a file back is not a neutral action once more than one user is involved.</p>

<h2>Where it landed</h2>

<p>
  The setup today: pull from upstream, push to the fork, all work happens on Forgejo. Prune is off
  everywhere. GitHub Actions are off on every fork. Timeouts are raised for the big repos. A small
  Rust tool refuses to touch anything until I have seen the full plan and said yes.
</p>

<p>
  None of this is unusual. Most of it came from learning, the hard way, which Forgejo defaults
  assume a passive mirror. Those same defaults stop being safe the moment you treat Forgejo as the
  place you actually work.
</p>
