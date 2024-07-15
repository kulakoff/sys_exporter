import express from 'express';
import { Registry, Gauge, collectDefaultMetrics, Counter } from 'prom-client';
import 'dotenv/config'
import axios from "axios";

const PORT = process.env.PORT;
const SERVICE_PREFIX = process.env.SERVICE_PREFIX
// Intercom models
const BEWARD_DKS = 'BEWARD DKS'
const QTECH = 'QTECH'

const app = express();

// Create a global registry for all metrics
const globalRegistry = new Registry();
globalRegistry.setDefaultLabels({app: "SmartYard-Server/intercom"})
// collectDefaultMetrics({ register: globalRegistry });

/**
 * Create and return common metrics
 * @param registers
 * @param withProbeSuccess
 * @returns {{sipStatusGauge: Gauge<string>, uptimeGauge: Gauge<string>}}
 */
const  createMetrics = (registers, withProbeSuccess = false) => {
    const sipStatusGauge = new Gauge({
        name: `${SERVICE_PREFIX}_sip_status`,
        help: 'SIP status of the intercom',
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

    if (withProbeSuccess) {
        const probeSuccess = new Gauge({
            name: `probe_success`,
            // name: `${SERVICE_PREFIX}_probe_success`,
            help: 'Displays whether or not the probe was a success',
            registers: registers,
        })
        metrics.probeSuccess = probeSuccess
    }

    return metrics;
}

// Create global metrics
const {
    sipStatusGauge: globalSipStatusGauge,
    uptimeGauge: globalUptimeGauge,
    // probeSuccess: globalProbeSuccess
} = createMetrics([globalRegistry]);

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
        requestRegistry.setDefaultLabels({app: "SmartYard-Server/intercom"})
        // Create request-specific metrics
        const {
            sipStatusGauge: requestSipStatusGauge,
            uptimeGauge: requestUptimeGauge,
            probeSuccess: requestProbeSuccessGauge
        } = createMetrics([requestRegistry], true);

        // Simulate fetching SIP status and uptime, replace with actual logic
        // const sipStatus = getSipStatus({url, username, password, model});
        // const uptime = getUptimeSeconds({url, username, password, model});

        const { sipStatus, uptimeSeconds }  = await getMetrics({url, username, password, model});

        // Update metrics in both the request-specific registry and the global registry
        requestSipStatusGauge.set({ url }, sipStatus);
        requestUptimeGauge.set({ url }, uptimeSeconds);
        requestProbeSuccessGauge.set(1)
        //
        globalSipStatusGauge.set({ url }, sipStatus);
        globalUptimeGauge.set({ url }, uptimeSeconds);
        // globalProbeSuccess.set(1)

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());
        requestRegistry.clear();
    } catch (error) {
        console.error('Failed to update metrics:', error.message);
        res.status(500).send('Failed to update metrics');
    }
});

// Simulated function to get SIP status
const getSipStatus = ({url, username, password, model}) => {
    return Math.floor(Math.random() * 2); // Simulated value, replace with actual logic
};

// Simulated function to get uptime in seconds
const getUptimeSeconds = ({url, username, password, model}) => {
    return Math.floor(Date.now() / 1000); // Simulated value, replace with actual logic
};

const getMetrics = async ({url, username, password, model}) => {

    /**
     * - switch model
     * - get sip status
     * - get uptime
     * - make registers data
     * - return metrics
     *
     */
    switch (model){
        case BEWARD_DKS:
            return await getBewardMetrics(url, username, password)
        case QTECH:
            return await getQtechMetrics(url, username, password)
        default:
            throw new Error(`Unsupported model: ${model}`);
    }
}

const getBewardMetrics = async (url, username = 'admin', password) => {
    console.log("RUN getBewardMetrics")
    // implement get Beward metrics
    const baseURL = url + '/cgi-bin'
    const PATH_SIP_STATUS = '/sip_cgi?action=regstatus&AccountReg'
    const PATH_SYSINFO = '/systeminfo_cgi?action=get'
    const instance = axios.create({
        baseURL: baseURL,
        timeout: 1000,
        auth: {
            username: username,
            password: password
        }
    });

    /**
     * Extract value of AccountReg1
     * @param data
     * @returns {number|number}
     */
    const parseSipStatus = (data) => {
        const match = data.match(/AccountReg1=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    };

    /**
     * Extract value of UpTime and convert to seconds
     * @param data
     * @returns {number}
     */
    const parseUptimeMatch = (data) => {
        const match = data.match(/UpTime=(\d+)\.(\d{2}):(\d{2}):(\d{2})/);
        if (match) {
            const days = parseInt(match[1], 10);
            const hours = parseInt(match[2], 10);
            const minutes = parseInt(match[3], 10);
            const seconds = parseInt(match[4], 10);
            return (days * 24 * 3600) + (hours * 3600) + (minutes * 60) + seconds;
        }
        return 0;
    }

    const sipStatusData = await instance.get(PATH_SIP_STATUS).then(({data}) => data)
    const sysInfoData = await instance.get(PATH_SYSINFO).then(({data}) => data)

    const sipStatus = parseSipStatus(sipStatusData)
    const uptimeSeconds = parseUptimeMatch(sysInfoData)

    return { sipStatus, uptimeSeconds }
}

const getQtechMetrics = async (url, username, password) => {
    // implement get Qtech metrics
}

// Start the server
app.listen(PORT, () => {
    console.log(`Exporter server is running on http://localhost:${PORT}/metrics`);
});
