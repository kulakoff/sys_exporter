import express from 'express';
import basicAuth from 'express-basic-auth';
import { createMetrics } from './metrics.js';
import { globalRegistry } from './globalRegistry.js';
import { handleProbeRequest } from './probes.js';

import {
    AUTH_ENABLED,
    AUTH_PASS,
    AUTH_USER,
    PORT,
} from './constants.js'

const app = express();

// api auth
if (AUTH_ENABLED) {
    app.use(basicAuth({
        users: {[AUTH_USER]: AUTH_PASS},
        challenge: true,
    }));
}

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', globalRegistry.contentType);
    res.end(await globalRegistry.metrics());
});

app.get('/probe', (req, res) => {
    handleProbeRequest(req, res, globalRegistry, createMetrics([globalRegistry], true));
});

app.listen(PORT, () => {
    console.log(`Exporter server is running on http://localhost:${PORT}`);
});