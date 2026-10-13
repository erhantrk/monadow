import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    include: ['test/**/*.test.ts'],
    // the reference SDK ships extension-less ESM imports; let vite transform it
    server: { deps: { inline: ['@scopelift/stealth-address-sdk'] } },
  },
});
