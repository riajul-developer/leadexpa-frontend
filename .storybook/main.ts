import type { StorybookConfig } from "@storybook/nextjs-vite";

// Component workshop (FRONTEND_PROMPT §3, §7): shared/ui and the SLA/lead components, in both locales and themes.
const config: StorybookConfig = {
  framework: { name: "@storybook/nextjs-vite", options: {} },
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  // Serves mockServiceWorker.js, so feature stories run on the same MSW seed data as the mock app.
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
};

export default config;
