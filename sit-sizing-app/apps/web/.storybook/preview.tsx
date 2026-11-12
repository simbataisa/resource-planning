import type { Preview } from '@storybook/nextjs-vite';
import { TooltipProvider } from '../components/ui/tooltip';
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    a11y: { test: 'error' },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="bg-background p-6 text-foreground">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};

export default preview;
