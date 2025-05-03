import { createDevApp } from '@backstage/dev-utils';
import { aiPluginPlugin, AiPluginPage } from '../src/plugin';

createDevApp()
  .registerPlugin(aiPluginPlugin)
  .addPage({
    element: <AiPluginPage />,
    title: 'Root Page',
    path: '/ai-plugin',
  })
  .render();
