/** @type {import('jest').Config} */

//  From https://github.com/liveblocks/liveblocks/blob/main/shared/jest-config/index.js

/**
 * Standard Jest configuration, used by all projects in this monorepo.
 */
module.exports = {
  // By default, assume Jest will be used in a DOM environment. If you need to
  // use "node", you can overwrite it in the project.
  testEnvironment: 'jsdom',

  preset: 'solid-jest/preset/browser',
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  testPathIgnorePatterns: ['__tests__/_.*'],
  roots: ['<rootDir>/src'],

  // Ensure `window.fetch` is polyfilled if it isn't available in the runtime
  setupFiles: ['./fetch-polyfill'],
}
