/**
 * Traffic Light Plugin Definition
 * Plugin for visualizing system health through traffic light indicators
 */
import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

// Create the plugin instance with routing configuration
export const trafficLightPlugin = createPlugin({
  id: 'traffic-light',
  routes: {
    root: rootRouteRef,
  },
});

// Create the main dashboard page component with lazy loading
export const TrafficLightPage = trafficLightPlugin.provide(
  createRoutableExtension({
    name: 'TrafficLightPage',
    component: () =>
      import('./components/TrafficComponent').then(m => m.TrafficComponent),
    mountPoint: rootRouteRef,
  }),
);
