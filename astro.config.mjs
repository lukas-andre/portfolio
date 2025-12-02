import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://lucashenry.dev',
  integrations: [react(), sitemap()],
  vite: {
    ssr: {
      noExternal: ['framer-motion']
    }
  }
});
