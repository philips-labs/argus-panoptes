import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { Router } from 'express';

export interface PluginEnvironment {
  logger: LoggerService;
  config: Config;
  router: Router;
}
