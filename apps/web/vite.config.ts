import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// .env lives at the repo root; only VITE_* variables reach the browser.
export default defineConfig({ plugins: [react()], envDir: '../..' });
