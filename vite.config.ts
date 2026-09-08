import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Where the generated reverse-proxy site block lands. Same convention as the
// other self-hosted projects: one `<app>.caddy` file the server-wide Caddyfile
// pulls in with `import /path/to/deploy/*.caddy`.
const CADDYFILE_PATH = 'deploy/portfolio.caddy';

// Port the adapter-node server listens on when nothing else says otherwise,
// matching the `serve` script in package.json.
const DEFAULT_PORT = '3000';

/**
 * Emits the Caddy site block for this app at the end of a production build.
 *
 * The domain is not baked into the repository: it comes from `DOMAIN` in
 * `.env`, so a fork or a staging host only has to change that one variable.
 * Without it there is nothing to write, and the build says so instead of
 * failing, since `pnpm build` also runs in places that never serve the site.
 */
const caddyfile = (env: Record<string, string>): Plugin => ({
  name: 'portfolio-caddyfile',
  apply: 'build',
  closeBundle() {
    const domain = env.DOMAIN?.trim();

    if (!domain) {
      this.warn(`DOMAIN is not set, skipping ${CADDYFILE_PATH}`);
      return;
    }

    const port = env.PORT?.trim() || DEFAULT_PORT;
    const output = resolve(process.cwd(), CADDYFILE_PATH);

    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${domain} {\n\treverse_proxy localhost:${port}\n}\n`);

    this.info(`wrote ${CADDYFILE_PATH} for ${domain} -> localhost:${port}`);
  }
});

export default defineConfig(({ mode }) => {
  // Third argument '' means "no prefix filter": Vite only exposes VITE_* to the
  // client bundle, but here the values stay on the build machine.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [sveltekit(), caddyfile(env)],
    server: {
      host: '0.0.0.0'
    }
  };
});
