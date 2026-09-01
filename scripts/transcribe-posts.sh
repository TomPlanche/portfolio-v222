#!/usr/bin/env bash

# Transcribes the Markdown notes in `src/lib/posts/sources` into the Svelte
# posts the blog renders, using the `md-to-blog-post` converter.
#
# A source is the note as written (selfnotes `+++` header, `#tags` and all);
# the post next to it is generated, so it is always overwritten rather than
# merged. Edit the note, run this, commit both.
#
#   scripts/transcribe-posts.sh                 # every note in sources/
#   scripts/transcribe-posts.sh monclub-bot     # just that one, by slug
#   scripts/transcribe-posts.sh path/to/note.md # or by path

set -euo pipefail

# Set the working directory to the root of the project
cd "$(dirname "$0")/.." || exit

sources_folder="src/lib/posts/sources"
destination_folder="src/lib/posts/"
converter_manifest="md-to-blog-post/Cargo.toml"
converter="md-to-blog-post/target/release/md-to-blog-post"

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  sed -n '3,11p' "$0" | cut -c 3-
  exit 0
fi

if [ ! -d "$sources_folder" ]; then
  echo "no $sources_folder to read: put the notes there first" >&2
  exit 1
fi

# The notes to transcribe: the ones named on the command line, or all of them.
sources=()

if [ "$#" -gt 0 ]; then
  for argument in "$@"; do
    if [ -f "$argument" ]; then
      sources+=("$argument")
    elif [ -f "$sources_folder/$argument" ]; then
      sources+=("$sources_folder/$argument")
    elif [ -f "$sources_folder/$argument.md" ]; then
      sources+=("$sources_folder/$argument.md")
    else
      echo "no such note: $argument" >&2
      exit 1
    fi
  done
else
  shopt -s nullglob
  sources=("$sources_folder"/*.md)
  shopt -u nullglob
fi

if [ "${#sources[@]}" -eq 0 ]; then
  echo "nothing to transcribe: $sources_folder holds no .md file"
  exit 0
fi

# Built once, in release: the loop then costs nothing per note, and a broken
# converter stops the run before it writes a single post.
cargo build --release --quiet --manifest-path "$converter_manifest"

# The posts written, for the single Prettier pass at the end.
written=()

for source in "${sources[@]}"; do
  output=$("$converter" "$source" --out-dir "$destination_folder" --force)

  written+=("$(printf '%s\n' "$output" | head -1)")

  echo "$source"
  printf '%s\n' "$output" | sed 's/^/  /'
done

# Prettier once over everything rather than per post: it is the slow part, and
# the converter's own `--format` would pay for it each time round the loop.
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec prettier --write --log-level warn "${written[@]}"
else
  echo "warning: pnpm not found, the posts are unformatted" >&2
fi

echo "transcribed ${#written[@]} post(s) into $destination_folder"
