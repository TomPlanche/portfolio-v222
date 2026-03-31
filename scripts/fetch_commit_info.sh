#!/bin/bash

# Load environment variables from .env file
set -a
source ../.env
set +a

# Fetch the last commit and save to JSON file
curl -s -H "Authorization: token $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     "https://api.github.com/repos/$REPO/commits?per_page=1" > "$OUTPUT_FILE"
