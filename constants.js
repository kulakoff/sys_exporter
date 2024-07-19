import 'dotenv/config'

export const PORT = process.env.PORT;
export const SERVICE_PREFIX = process.env.SERVICE_PREFIX || 'sys_intercom';
export const AUTH_ENABLED = process.env.AUTH_ENABLED === 'false';
export const AUTH_USER = process.env.AUTH_USER;
export const AUTH_PASS = process.env.AUTH_PASS;
// Intercom models
export const BEWARD_DKS = 'BEWARD DKS'
export const BEWARD_DS = 'BEWARD DS'
export const QTECH = 'QTECH'
export const AKUVOX = 'AKUVOX'