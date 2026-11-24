import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'

export default defineConfig({
  base: './',
  plugins: [react()],
  optimizeDeps: { esbuildOptions: { plugins: [{
    name: 'theatre-local-development',
    setup(build) {
      build.onLoad({ filter: /@theatre[/\\]studio[/\\]dist[/\\]index\.js$/ }, async ({ path }) => ({
        // Studio 0.7.2 não oferece opção pública para desativar essa consulta.
        // O editor local não precisa de rede para verificar atualizações.
        contents: (await readFile(path, 'utf8')).replaceAll('https://updates.theatrejs.com/updates/0.7.2',
          'data:application/json,%7B%22hasUpdates%22%3Afalse%7D'),
        loader: 'js',
      }))
    },
  }] } },
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
