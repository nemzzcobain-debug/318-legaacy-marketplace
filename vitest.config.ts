import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // tsconfig garde le JSX tel quel pour Next.js : les tests doivent le transformer eux-mêmes
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
