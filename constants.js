import 'dotenv/config'

export const APP_NAME = process.env.APP_NAME
export const APP_PORT = process.env.APP_PORT;
export const APP_HOST = process.env.APP_HOST || "localhost";
export const SERVICE_PREFIX = process.env.SERVICE_PREFIX || 'sys_intercom';
export const AUTH_ENABLED = process.env.AUTH_ENABLED || false;
export const AUTH_USER = process.env.AUTH_USER;
export const AUTH_PASS = process.env.AUTH_PASS;

// Intercom models
export const BEWARD_DKS = 'BEWARD DKS'
export const BEWARD_DS = 'BEWARD DS'
export const QTECH = 'QTECH'
export const AKUVOX = 'AKUVOX'
