import type { StorybookConfig } from '@storybook/nextjs-vite';

/** Component catalogue for review of layers 2 and 3 with the TCB-DS tokens (design 8, U-01..U-03). */
const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/nextjs-vite', options: {} },
  core: { disableTelemetry: true },
};

export default config;
