import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const doraDashboardPlugin = createPlugin({
  id: 'dora-dashboard',
  routes: {
    root: rootRouteRef,
  },
});

export const DoraDashboardPage = doraDashboardPlugin.provide(
  createRoutableExtension({
    name: 'DoraDashboardPage',
    component: () =>
      import('./components/DashboardComponent').then(m => m.DashboardComponent),
    mountPoint: rootRouteRef,
  }),
);
