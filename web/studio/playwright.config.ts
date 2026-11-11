import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('../../.studio-cache/browsers')
const port = Number(process.env.AMARRA_TEST_PORT ?? 8010)
const baseURL = `http://127.0.0.1:${port}`
const python = process.platform === 'win32'
  ? resolve('../../.venv/Scripts/python.exe')
  : resolve('../../.venv/bin/python')

export default defineConfig({
  testDir: './e2e', timeout: 30000, workers: 1,
  expect: { timeout: 10000 }, // Inclui a validação do cache no Worker antes de liberar os controles.
  outputDir: '../../.studio-cache/test-results', reporter: 'list',
  use: { baseURL, viewport: { width: 1440, height: 1080 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] } },
  webServer: { command: `"${python}" "${resolve('../../studio.py')}" --port ${port}`,
    url: `${baseURL}/api/health`, reuseExistingServer: false, timeout: 30000 },
})
