/**
 * AI Plugin Definition
 * Plugin for AI-generated commit summaries and release notes
 */
import {
  createPlugin,
  createRoutableExtension,
  createRouteRef,
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

// Route reference for commit message analysis page
export const commitMessagesRouteRef = createRouteRef({
  id: 'commit-messages-test',
});

// Create the plugin instance with routing configuration
export const aiPluginPlugin = createPlugin({
  id: 'ai-plugin',
  routes: {
    root: rootRouteRef,
  },
});

// Create the main page component with lazy loading
export const AiPluginPage = aiPluginPlugin.provide(
  createRoutableExtension({
    name: 'AiPluginPage',
    component: () =>
      import('./components/AISummariesPage').then(m => m.AISummaries),
    mountPoint: rootRouteRef,
  }),
);
