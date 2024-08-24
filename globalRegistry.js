import { Registry } from 'prom-client';
import { APP_NAME } from './constants.js';

export const globalRegistry = new Registry();
globalRegistry.setDefaultLabels({ app: APP_NAME });