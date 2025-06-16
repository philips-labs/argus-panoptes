import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const trafficLightPlugin = createPlugin({
  id: 'traffic-light',
  routes: {
    root: rootRouteRef,
  },
});

export const TrafficLightPage = trafficLightPlugin.provide(
  createRoutableExtension({
    name: 'TrafficLightPage',
    component: () =>
      import('./components/TrafficComponent').then(m => m.TrafficComponent),
    mountPoint: rootRouteRef,
  }),
);
