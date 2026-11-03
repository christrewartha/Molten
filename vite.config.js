import { defineConfig } from 'vite'

// Relative asset paths, so the build works from any folder (itch.io serves
// HTML games from a sub-path).
export default defineConfig({
  base: './',
  // Older phones (iOS before 16.4) cannot run newer syntax such as class
  // static blocks, and the whole game would fail to load.
  build: { target: ['es2020', 'safari14'] },
})
