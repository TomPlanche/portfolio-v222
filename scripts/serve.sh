#!/bin/bash

# Starts the built server with the environment from .env.
#
# `vite dev` loads .env by itself; the built server does not, it just reads
# process.env at runtime. Whatever supervises it (pm2, systemd, a container)
# has to put the variables there, so point the supervisor at this script
# rather than at `node build/index.js`. Same approach as `build.sh`.

# Set the working directory to the root of the project
cd "$(dirname "$0")/.." || exit

# Load environment variables from .env file, if there is one. On a host that
# sets them some other way (a systemd unit, a container), there is nothing to
# load and the server still gets what it needs.
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# `exec` so the supervisor tracks node itself, not this wrapper: signals and
# restarts then reach the server directly.
exec node build/index.js
