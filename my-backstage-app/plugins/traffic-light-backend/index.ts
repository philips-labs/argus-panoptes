import { createBackendModule } from '@backstage/backend-plugin-api';
import { loggerToWinstonLogger } from '@backstage/backend-common';
import { createRouter } from './src/service/router'; // or wherever your router is
import { backendPlugin } from '@backstage/backend-plugin-api';

export const trafficLightBackendModule = createBackendModule({
  pluginId: 'traffic-light',
  moduleId: 'default',
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPlugin.logger,
        httpRouter: backendPlugin.httpRouter,
        config: backendPlugin.config,
      },
      async init({ logger, httpRouter, config }) {
        const winstonLogger = loggerToWinstonLogger(logger);
        const router = await createRouter({ config, logger: winstonLogger });
        httpRouter.use('/traffic-light', router);
      },
    });
  },
});
