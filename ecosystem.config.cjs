// pm2 config for the portfolio site, under the "portfolio" namespace so it can
// be managed as a group (pm2 restart/stop/delete portfolio) alongside the other
// apps on the host. package.json has "type": "module", so this file stays .cjs
// for pm2's require()-based config loading.
module.exports = {
  apps: [
    {
      name: 'site',
      namespace: 'portfolio',
      // adapter-node build output (`pnpm build`); it doesn't read .env on its
      // own, hence the node flag. Same approach as the `serve` script in
      // package.json, without the bash wrapper of scripts/serve.sh, so pm2
      // supervises node directly.
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
    }
  ]
};
