import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// base './' makes the build work from any folder (a site root or something
// like https://you.github.io/enyalie/) without changing anything.
// Vitest also reads this file. Tests live in tests/ and run in Node.
export default defineConfig({
  base: './',
  plugins: [react()],
});
