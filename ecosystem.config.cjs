// pm2 config for the portfolio site, under the "portfolio" namespace so it can
// be managed as a group (pm2 restart/stop/delete portfolio) alongside the other
// apps on the host. package.json has "type": "module", so this file stays .cjs
// for pm2's require()-based config loading.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseEnv } = require('node:util');

// The "next" site listens on NEXT_PORT, read from .env with parseEnv so that
// nothing is added to pm2's own environment (see the note on PORT below).
const NEXT_PORT_DEFAULT = '3001';

const readEnvFile = () => {
  try {
    return parseEnv(readFileSync(join(__dirname, '.env'), 'utf8'));
  } catch {
    return {};
  }
};

const nextPort = readEnvFile().NEXT_PORT?.trim() || process.env.NEXT_PORT || NEXT_PORT_DEFAULT;

module.exports = {
  apps: [
    {
      name: 'site',
      namespace: 'portfolio',
      // adapter-node build output (`pnpm build:main`, or `pnpm build` for the
      // checked-out branch); it doesn't read .env on its own, hence the node
      // flag. Same approach as the `serve` script in package.json, without the
      // bash wrapper of scripts/serve.sh, so pm2 supervises node directly.
      script: 'build/index.js',
      node_args: ['--env-file-if-exists=.env'],
      cwd: __dirname,
      autorestart: true,
      watch: false,
      env: {
        // PORT is deliberately left out: a variable already in the environment
        // wins over --env-file, and .env has to stay the single source of truth
        // since the build reads the same value to write deploy/portfolio.caddy.
        // Unset everywhere, adapter-node listens on 3000, which is what the
        // generated Caddy block proxies to.
        NODE_ENV: 'production'
      }
    },
    {
      name: 'next-site',
      namespace: 'portfolio',
      // The branch named by NEXT_BRANCH in .env, built by `pnpm build:next`.
      script: 'next-build/index.js',
      node_args: ['--env-file-if-exists=.env'],
      cwd: __dirname,
      autorestart: true,
      watch: false,
      env: {
        // Unlike `site`, PORT is set here on purpose: .env holds the main
        // site's PORT, and this one has to listen somewhere else. A variable in
        // the environment wins over --env-file, so this overrides it. The value
        // is NEXT_PORT from .env, 3001 when unset. No Caddy block is generated
        // for it; the host's Caddyfile has to proxy to this port itself.
        NODE_ENV: 'production',
        PORT: nextPort
      }
    }
  ]
};
