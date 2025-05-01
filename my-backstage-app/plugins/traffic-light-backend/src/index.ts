import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

export const trafficLightBackendModule = createBackendModule({
  pluginId: 'traffic-light',
  moduleId: 'default',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ config, logger, httpRouter }) {
        const router = await createRouter({ config, logger });
        httpRouter.use(router);
      },
    });
  },
});
