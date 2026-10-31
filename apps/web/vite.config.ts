import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// .env lives at the repo root; only VITE_* variables reach the browser.
// Absolute path so it resolves the same way after Vite restarts itself.
export default defineConfig({ plugins: [react()], envDir: fileURLToPath(new URL('../..', import.meta.url)) });
