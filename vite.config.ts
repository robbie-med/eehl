/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// `--mode android` builds with relative asset URLs for the Android shell,
// which serves the bundle from https://appassets.androidplatform.net/.
export default defineConfig(({ mode }) => ({
  base: mode === 'android' ? './' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __ANDROID__: JSON.stringify(mode === 'android'),
  },
  build: {
    target: 'es2020',
    outDir: mode === 'android' ? 'dist-android' : 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
