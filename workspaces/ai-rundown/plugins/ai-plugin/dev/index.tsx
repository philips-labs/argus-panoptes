/**
 * AI Plugin Development Harness
 * Standalone dev environment for testing the plugin
 */
import { createDevApp } from '@backstage/dev-utils';
import { aiPluginPlugin, AiPluginPage } from '../src/plugin';

// Create and configure development application
createDevApp()
  // Register the plugin with the dev app
  .registerPlugin(aiPluginPlugin)
  // Add the main page component with routing
  .addPage({
    element: <AiPluginPage />,
    title: 'Root Page',
    path: '/ai-plugin',
  })
  // Start the standalone dev server
  .render();
