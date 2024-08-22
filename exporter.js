import 'dotenv/config'
import express from 'express';
import { Gauge, Registry } from 'prom-client';
import basicAuth from 'express-basic-auth';
import { getAkuvoxMetrics, getBewardMetrics, getQtechMetrics } from './metrics/index.js'
import {
    AKUVOX,
    APP_NAME,
    AUTH_ENABLED,
    AUTH_PASS,
    AUTH_USER,
    BEWARD_DKS,
    BEWARD_DS,
    PORT,
    QTECH,
    SERVICE_PREFIX
} from './constants.js'

const app = express();

// Create a global registry for all metrics
const globalRegistry = new Registry();
globalRegistry.setDefaultLabels({app: APP_NAME})
// Host system metrics, optional
// collectDefaultMetrics({ register: globalRegistry });

/**
 * Create and return common metrics
 * @param registers
 * @param isGlobal
 * @returns {{sipStatusGauge: Gauge<string>, uptimeGauge: Gauge<string>}}
 */
const createMetrics = (registers, isGlobal = false) => {
    const sipStatusGauge = new Gauge({
        name: `${SERVICE_PREFIX}_sip_status`,
        help: 'SIP status of the intercom. 0 = offline; 1 = online',
        labelNames: ['url'],
        registers: registers,
    });

    const uptimeGauge = new Gauge({
        name: `${SERVICE_PREFIX}_uptime_seconds`,
        help: 'Uptime of the intercom in seconds',
        labelNames: ['url'],
        registers: registers,
    });

    const metrics = {sipStatusGauge, uptimeGauge}

    if (!isGlobal) {
        metrics.probeSuccess = new Gauge({
            name: `probe_success`,
            // name: `${SERVICE_PREFIX}_probe_success`,
            help: 'Displays whether or not the probe was a success',
            labelNames: ['url'],
            registers: registers,
        })
    }

    return metrics;
}

/**
 * TODO: not used global metrics
 */
// Create global metrics
const {
    sipStatusGauge: globalSipStatusGauge,
    uptimeGauge: globalUptimeGauge,
} = createMetrics([globalRegistry], true);

// auth
if (AUTH_ENABLED) {
    app.use(basicAuth({
        users: {[AUTH_USER]: AUTH_PASS},
        challenge: true,
    }));
}

/**
 * TODO: not used
 */
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', globalRegistry.contentType);
    res.end(await globalRegistry.metrics());
});

app.get('/probe', async (req, res) => {
    const { url, username, password, model } = req.query;

    if (!url || !username || !password || !model) {
        return res.status(400).send('Missing required query parameters: url, username, password, model');
    }

    console.log("Probe req > " + url);

    // Create request-specific registry
    const requestRegistry = new Registry();
    requestRegistry.setDefaultLabels({app: APP_NAME})

    // Create request-specific metrics
    const {
        sipStatusGauge: requestSipStatusGauge,
        uptimeGauge: requestUptimeGauge,
        probeSuccess: requestProbeSuccessGauge
    } = createMetrics([requestRegistry]);

    try {
        const { sipStatus, uptimeSeconds }  = await getMetrics({url, username, password, model});

        // Update metrics per request-specific
        requestSipStatusGauge.set({ url }, sipStatus);
        requestUptimeGauge.set({ url }, uptimeSeconds);
        requestProbeSuccessGauge.set({ url },1);

        // update  global registry
        globalSipStatusGauge.set({ url }, sipStatus);
        globalUptimeGauge.set({ url }, uptimeSeconds);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());

        requestRegistry.clear();
    } catch (error) {
        console.error('Failed to update metrics:', error.message);
        requestProbeSuccessGauge.set({ url }, 0);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());

        requestRegistry.clear();
    }
});

const getMetrics = async ({url, username, password, model}) => {
    switch (model) {
        case BEWARD_DS:
        case BEWARD_DKS:
            return await getBewardMetrics(url, username, password);
        case QTECH:
            return await getQtechMetrics(url, username, password);
        case AKUVOX:
            return await getAkuvoxMetrics(url, username, password);
        default:
            throw new Error(`Unsupported model: ${model}`);
    }
}

// Start the server
app.listen(PORT, () => {
    console.log(`Exporter server is running on http://localhost:${PORT}`);
});
