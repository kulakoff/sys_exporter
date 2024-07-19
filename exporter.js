import express from 'express';
import { Gauge, Registry } from 'prom-client';
import 'dotenv/config'
import axios from "axios";
import DigestFetch from "digest-fetch";
import basicAuth from 'express-basic-auth';

import { getBewardMetrics, getQtechMetrics, getAkuvoxMetrics } from './metrics'


const PORT = process.env.PORT;
const SERVICE_PREFIX = process.env.SERVICE_PREFIX || 'sys_intercom';

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'false';
const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASS = process.env.AUTH_PASS;

// Intercom models
const BEWARD_DKS = 'BEWARD DKS'
const BEWARD_DS = 'BEWARD DS'
const QTECH = 'QTECH'
const AKUVOX = 'AKUVOX'

const app = express();

// Create a global registry for all metrics
const globalRegistry = new Registry();
globalRegistry.setDefaultLabels({app: "SmartYard-Server/intercom"})
// Host system metrics, optional
// collectDefaultMetrics({ register: globalRegistry });

/**
 * Create and return common metrics
 * @param registers
 * @param isGlobal
 * @returns {{sipStatusGauge: Gauge<string>, uptimeGauge: Gauge<string>}}
 */
const  createMetrics = (registers, isGlobal = false) => {
    const sipStatusGauge = new Gauge({
        name: `${SERVICE_PREFIX}_sip_status`,
        help: 'SIP status of the intercom. 0 - offline, 1 - online',
        labelNames: ['url'],
        registers: registers,
    });

    const uptimeGauge = new Gauge({
        name: `${SERVICE_PREFIX}_uptime_seconds`,
        help: 'Uptime of the intercom in seconds',
        labelNames: ['url'],
        registers: registers,
    });

    const metrics = { sipStatusGauge, uptimeGauge }

    if (!isGlobal) {
        metrics.probeSuccess = new Gauge({
            name: `probe_success`,
            // name: `${SERVICE_PREFIX}_probe_success`,
            help: 'Displays whether or not the probe was a success',
            registers: registers,
        })
    }

    return metrics;
}

// Create global metrics
const {
    sipStatusGauge: globalSipStatusGauge,
    uptimeGauge: globalUptimeGauge,
} = createMetrics([globalRegistry], true);

// auth
if (AUTH_ENABLED) {
    app.use(basicAuth({
        users: { [AUTH_USER]: AUTH_PASS },
        challenge: true,
    }));
}

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
    requestRegistry.setDefaultLabels({app: "SmartYard-Server/intercom"})

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
        requestProbeSuccessGauge.set(1);

        // update  global registry
        globalSipStatusGauge.set({ url }, sipStatus);
        globalUptimeGauge.set({ url }, uptimeSeconds);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());

        requestRegistry.clear();
    } catch (error) {
        console.error('Failed to update metrics:', error.message);
        requestProbeSuccessGauge.set(0);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());

        requestRegistry.clear();
    }
});

const getMetrics = async ({url, username, password, model}) => {
    switch (model){
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
    console.log(`Exporter server is running on http://localhost:${PORT}/metrics`);
});
