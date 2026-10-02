import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Tests that format dates assume a fixed timezone.
    env: { TZ: 'Europe/Moscow' },
  },
})
