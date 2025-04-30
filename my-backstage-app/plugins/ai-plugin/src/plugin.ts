import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

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
      import('./components/ExampleComponent').then(m => m.ExampleComponent),
    mountPoint: rootRouteRef,
  }),
);
