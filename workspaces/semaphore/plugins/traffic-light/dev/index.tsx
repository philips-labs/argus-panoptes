import { createDevApp } from '@backstage/dev-utils';
import { trafficLightPlugin, TrafficLightPage } from '../src/plugin';

createDevApp()
  .registerPlugin(trafficLightPlugin)
  .addPage({
    element: <TrafficLightPage />,
    title: 'Root Page',
    path: '/traffic-light',
  })
  .render();
