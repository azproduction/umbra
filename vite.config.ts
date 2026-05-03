import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { defineConfig as defineTestConfig } from 'vitest/config';

export default defineConfig({
  ...defineTestConfig({ test: { environment: 'node' } }),
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  base: '/umbra/',
});
