// Dev-only test config. Serves the site folder as-is (same as GitHub Pages).
const { defineConfig, devices } = require('@playwright/test');
const PORT = Number(process.env.PORT || 4301);

module.exports = defineConfig({
  testDir: './tests',
  workers: 2,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx serve . -l ${PORT} --no-clipboard`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
