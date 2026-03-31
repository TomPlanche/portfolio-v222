#!/bin/bash

# Set the working directory to the root of the project
cd "$(dirname "$0")/.." || exit

# Load environment variables from .env file
set -a
source .env
set +a

# run `fetch_commit_info.sh` to get the latest commit info and save it to a JSON file
bash scripts/fetch_commit_info.sh

bun run build

