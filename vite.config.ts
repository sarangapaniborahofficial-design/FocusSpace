import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

function autoReviewPlugin(): Plugin {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const triggerReview = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const { spawn } = await import('node:child_process');
        const scriptPath = path.resolve(currentDir, 'scripts/generate-review.mjs');
        if (fs.existsSync(scriptPath)) {
          const child = spawn(process.execPath, [scriptPath, '--silent'], {
            stdio: 'ignore',
            detached: true,
          });
          child.unref();
        }
      } catch {}
    }, 1500);
  };

  return {
    name: 'auto-review-generator',
    buildStart() {
      triggerReview();
    },
    handleHotUpdate({ file }) {
      if (!file.includes('review.txt') && !file.includes('.git')) {
        triggerReview();
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDesktopMode = mode === 'desktop' || mode === 'electron';

  return {
    plugins: [
      react(),
      tailwindcss(),
      autoReviewPlugin(),
      VitePWA({
        disable: isDesktopMode,
        registerType: 'prompt',
        manifest: {
          name: 'FocusSpace',
          short_name: 'FocusSpace',
          description: 'Local-first productivity app',
          theme_color: '#18181b',
          background_color: '#09090b',
          display: 'standalone',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 3000000
        }
      }),
    ],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  };
});
