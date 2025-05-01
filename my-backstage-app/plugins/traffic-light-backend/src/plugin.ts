import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import {createRouter} from './service/router';

export const trafficLightBackendModule = createBackendModule({
  pluginId: 'traffic-light',
  moduleId: 'default',
  register(env) {
    env.registerInit({
      deps: {
        router: coreServices.httpRouter,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ router, config, logger }) {
        const trafficLightRouter = await createRouter({ config, logger});
        trafficLightRouter.use('/traffic-light');
      },
    });
  },
});
