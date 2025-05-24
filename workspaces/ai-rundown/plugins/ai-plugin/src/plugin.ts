import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';
import { createRouteRef } from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

export const commitMessagesRouteRef = createRouteRef({
  id: 'commit-messages-test',
});

export const aiPluginPlugin = createPlugin({
  id: 'ai-plugin',
  routes: {
    root: rootRouteRef,
  },
});

export const AiPluginPage = aiPluginPlugin.provide(
  createRoutableExtension({
    name: 'AiPluginPage',
    component: () =>
      import('./components/CommitMessageTestPage').then(
        m => m.CommitMessageTestPage,
      ),
    mountPoint: rootRouteRef,
  }),
);
