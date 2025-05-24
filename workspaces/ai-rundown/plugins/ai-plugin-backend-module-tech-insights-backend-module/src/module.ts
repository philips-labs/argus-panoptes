/**
 * This file registers a backend module with the tech-insights plugin
 * Adds a custom fact retriever to the system, githubCommitRetriever
 * Allows the plugin to collect commits for usage
 */

//imports the utility function used to define and create a backend module in Backstage
import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
//imports the tech insights extension point that lets you plug in custom FactRetrievers
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
//imports retriever that queries github data
import { createGitHubCommitMessageRetriever } from './githubCommitRetriever';

export default createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'github-commit-message-retriever-module',
  register(env) {
    env.registerInit({
      deps: {
        providers: techInsightsFactRetrieversExtensionPoint,
        logger: coreServices.rootLogger,
      },
      async init({ providers, logger }) {
        logger.info('Registering GitHub Commit Message Fact Retriever...');
        providers.addFactRetrievers({
          [createGitHubCommitMessageRetriever.id]:
            createGitHubCommitMessageRetriever,
        });
      },
    });
  },
});
