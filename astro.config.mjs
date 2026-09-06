import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://lucashenry.dev',
  integrations: [
    react(),
    mdx(),
    {
      name: 'isolated-vite-cache',
      hooks: {
        'astro:config:setup': ({ command, config, updateConfig }) => {
          // Astro 4's content sync also starts a Vite optimizer. Builds, checks,
          // and a second dev server must not replace an active preview's deps.
          const namespace = command === 'dev' ? `dev-${config.server.port}` : command;
          updateConfig({
            vite: {
              cacheDir: fileURLToPath(new URL(`./node_modules/.vite/${namespace}/`, config.root)),
            },
          });
        },
      },
    },
    sitemap({
      filter: (page) => !(
        page.endsWith('.md')
        || page.endsWith('.xml')
        || page.endsWith('.json')
        || page.endsWith('.txt')
        || page.includes('/open-graph/')
        || page.includes('/images/notes/diagrams/')
      ),
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['framer-motion']
    }
  }
});
