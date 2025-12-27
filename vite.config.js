import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import * as child from "child_process";
import generateFile from 'vite-plugin-generate-file'
import manifest from "./manifest";

// version should be atomic, derived from the commit hash,
const version = `1.${child.execSync('git rev-list --count HEAD')}.${child.execSync('git rev-parse --short HEAD')}`.replaceAll('\n','');

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(version),
  },
  
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        owl20: resolve(__dirname, 'owl20.html'),
      },
    },
  },
  // write version to manifest
   plugins: [
    generateFile([{
      type: 'json',
      output: './manifest.json',
      data: {...manifest, version}
    }])
  ]
})
