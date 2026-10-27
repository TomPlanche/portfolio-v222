#!/bin/bash

# Builds the site from two git branches, whatever is checked out right now.
#
#   scripts/build-branches.sh [main|next|all]     (default: all)
#
# - `main` builds the `main` branch into `build/`.
# - `next` builds the branch named by NEXT_BRANCH in .env into `next-build/`.
#
# Each branch is checked out in its own git worktree under `.build-trees/` and
# built there with its own dependencies, so the working copy is never touched
# and the branch does not need to know about this script. The worktrees stay in
# place between runs, which keeps `pnpm install` fast. The build output is then
# copied next to the project, replacing the previous one in a single move so a
# running server never sees a half-written directory.
#
# The branch is read from origin when it is there (after a fetch), and from the
# local branch otherwise.

set -euo pipefail

# Set the working directory to the root of the project
cd "$(dirname "$0")/.." || exit
ROOT=$PWD

TARGET=${1:-all}
MAIN_BRANCH=main
TREES_DIR=.build-trees

# The branches and ports come from .env, like for the other scripts. A host that
# sets them some other way has no file to load and the script still works.
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Prints the ref to build for a branch name: the freshly fetched remote branch
# if there is one, else the local one.
resolve_ref() {
  local branch=$1

  git fetch --quiet origin "$branch" 2>/dev/null || true

  if git rev-parse --verify --quiet "refs/remotes/origin/$branch" >/dev/null; then
    echo "origin/$branch"
  elif git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null; then
    echo "$branch"
  else
    return 1
  fi
}

# build_branch <label> <branch> <output dir>
build_branch() {
  local label=$1 branch=$2 output=$3
  local tree="$TREES_DIR/$label"
  local ref

  if ! ref=$(resolve_ref "$branch"); then
    echo "error: branch '$branch' exists neither on origin nor locally" >&2
    return 1
  fi

  echo "==> $label: building $ref ($(git rev-parse --short "$ref")) into $output/"

  if [ -d "$tree" ]; then
    git -C "$tree" checkout --quiet --detach --force "$ref"
  else
    mkdir -p "$TREES_DIR"
    git worktree add --quiet --detach "$tree" "$ref"
  fi

  # The build reads .env from its own working directory.
  if [ -f .env ]; then
    ln -sf "$ROOT/.env" "$tree/.env"
  fi

  (
    cd "$tree"

    pnpm install --frozen-lockfile

    # The layout imports static/website_infos.json, which is not committed, so
    # a fresh worktree has none. Start from the project's copy, then try to
    # refresh it with the same step as scripts/build.sh. A failed refresh keeps
    # the copy instead of stopping the build.
    if [ -f "$ROOT/static/website_infos.json" ]; then
      cp "$ROOT/static/website_infos.json" static/website_infos.json
    fi

    if [ -f .env ] && ! bash "$ROOT/scripts/fetch_commit_info.sh"; then
      echo "warning: could not refresh static/website_infos.json" >&2
    fi

    pnpm run build
  )

  # Swap the output in: copy beside the target first, then move over it.
  rm -rf "$output.tmp"
  cp -R "$tree/build" "$output.tmp"
  rm -rf "$output"
  mv "$output.tmp" "$output"

  echo "==> $label: done, $output/"
}

build_main() {
  build_branch main "$MAIN_BRANCH" build

  # Only the main site owns the Caddy block; `next` writes one for the same
  # DOMAIN and PORT, which would be wrong for it, so its copy is dropped.
  if [ -f "$TREES_DIR/main/deploy/portfolio.caddy" ]; then
    mkdir -p deploy
    cp "$TREES_DIR/main/deploy/portfolio.caddy" deploy/portfolio.caddy
  fi
}

build_next() {
  if [ -z "${NEXT_BRANCH:-}" ]; then
    echo "NEXT_BRANCH is not set in .env, skipping the next build" >&2
    return 1
  fi

  build_branch next "$NEXT_BRANCH" next-build
}

case "$TARGET" in
  main)
    build_main
    ;;
  next)
    build_next
    ;;
  all)
    build_main
    # With `all`, a missing NEXT_BRANCH is not an error: the main build stands.
    if [ -n "${NEXT_BRANCH:-}" ]; then
      build_next
    else
      echo "NEXT_BRANCH is not set in .env, skipping the next build"
    fi
    ;;
  *)
    echo "usage: $0 [main|next|all]" >&2
    exit 2
    ;;
esac
