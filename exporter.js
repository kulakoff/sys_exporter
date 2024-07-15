import express from 'express';
import { Registry, Gauge, collectDefaultMetrics } from 'prom-client';
import 'dotenv/config'

const PORT = process.env.PORT;
const app = express();

// Create a global registry for all metrics
const globalRegistry = new Registry();
// collectDefaultMetrics({ register: globalRegistry });

/**
 * Create and return common metrics
 * @param registers
 * @returns {{sipStatusGauge: Gauge<string>, uptimeGauge: Gauge<string>}}
 */
const  createMetrics = (registers) => {
    const sipStatusGauge = new Gauge({
        name: 'sip_status',
        help: 'SIP status of the intercom',
        labelNames: ['url', 'model'],
        registers: registers,
    });

    const uptimeGauge = new Gauge({
        name: 'uptime_seconds',
        help: 'Uptime of the intercom in seconds',
        labelNames: ['url', 'model'],
        registers: registers,
    });

    return { sipStatusGauge, uptimeGauge };
}

// Create global metrics
const { sipStatusGauge: globalSipStatusGauge, uptimeGauge: globalUptimeGauge } = createMetrics([globalRegistry]);

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', globalRegistry.contentType);
    res.end(await globalRegistry.metrics());
});

app.get('/probe', async (req, res) => {
    const { url, username, password, model } = req.query;

    if (!url || !username || !password || !model) {
        return res.status(400).send('Missing required query parameters: url, username, password, model');
    }

    try {
        // Create a separate registry for this request
        const requestRegistry = new Registry();

        // Create request-specific metrics
        const { sipStatusGauge: requestSipStatusGauge, uptimeGauge: requestUptimeGauge } = createMetrics([requestRegistry]);

        // Simulate fetching SIP status and uptime, replace with actual logic
        const sipStatus = getSipStatus(url, username, password);
        const uptime = getUptimeSeconds(url, username, password);

        // Update metrics in both the request-specific registry and the global registry
        requestSipStatusGauge.set({ url, model }, sipStatus);
        requestUptimeGauge.set({ url, model }, uptime);

        globalSipStatusGauge.set({ url, model }, sipStatus);
        globalUptimeGauge.set({ url, model }, uptime);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());
    } catch (error) {
        console.error('Failed to update metrics:', error.message);
        res.status(500).send('Failed to update metrics');
    }
});

// Simulated function to get SIP status
const getSipStatus = (url, username, password) => {
    return Math.floor(Math.random() * 2); // Simulated value, replace with actual logic
};

// Simulated function to get uptime in seconds
const getUptimeSeconds = (url, username, password) => {
    return Math.floor(Date.now() / 1000); // Simulated value, replace with actual logic
};

// Start the server
app.listen(PORT, () => {
    console.log(`Exporter server is running on http://localhost:${PORT}/metrics`);
});
