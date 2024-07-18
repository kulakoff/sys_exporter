import express from 'express';
import { Gauge, Registry } from 'prom-client';
import 'dotenv/config'
import axios from "axios";
import DigestFetch from "digest-fetch";

const PORT = process.env.PORT;
const SERVICE_PREFIX = process.env.SERVICE_PREFIX
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


    // Create a separate registry for this request
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

        // Update metrics in both the request-specific registry and the global registry
        requestSipStatusGauge.set({ url }, sipStatus);
        requestUptimeGauge.set({ url }, uptimeSeconds);
        requestProbeSuccessGauge.set(1)

        globalSipStatusGauge.set({ url }, sipStatus);
        globalUptimeGauge.set({ url }, uptimeSeconds);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());
        requestRegistry.clear();
    } catch (error) {
        console.error('Failed to update metrics:', error.message);

        requestProbeSuccessGauge.set(0)

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());
        requestRegistry.clear();
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

const getBewardMetrics = async (url, username = 'admin', password) => {
    console.log("RUN getBewardMetrics > " + url );
    // implement get Beward metrics
    const BASE_URL = url + '/cgi-bin';
    const PATH_SIP_STATUS = '/sip_cgi?action=regstatus&AccountReg';
    const PATH_SYSINFO = '/systeminfo_cgi?action=get';

    const instance = axios.create({
        baseURL: BASE_URL,
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

    try {
        const [sipStatusData, sysInfoData] = await Promise.all([
            instance.get(PATH_SIP_STATUS).then(({data}) => data),
            instance.get(PATH_SYSINFO).then(({data}) => data)
        ]);

        const sipStatus = parseSipStatus(sipStatusData);
        const uptimeSeconds = parseUptimeMatch(sysInfoData);

        return { sipStatus, uptimeSeconds };
    } catch (err){
        console.error(`Error fetching metrics from device ${url}:  ${err.message}`);
        throw new Error('Failed to fetch metrics from intercom');
    }
}

const getQtechMetrics = async (url, username, password) => {
    // implement get Qtech metrics
}

const getAkuvoxMetrics = async (url, username, password) => {
    console.log("RUN getAkuvoxMetrics > " + url );
    const digestClient = new DigestFetch(username, password);
    const BASE_URL = url + '/api'
    const statusPayload = {
        target: 'system',
        action: 'status'
    };
    const infoPayload = {
        target: 'system',
        action: 'info'
    };

    class DigestClient {
        constructor(client, baseUrl) {
            this.client = client;
            this.baseUrl = baseUrl;
        }

        async post(endpoint, payload) {
            const response = await this.client.fetch(this.baseUrl + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.json();
        }
    }
    const instance = new DigestClient(digestClient, BASE_URL);

    try {
        const [statusResponse, infoResponse] = await Promise.all([
            instance.post('', statusPayload).then(({data}) => data),
            instance.post('', infoPayload).then(({data}) => data)
        ]);

        const parseUptime = (data) => {
            return data.UpTime ?? 0;
        };

        const parseSipStatus = (data) => {
            return data.Account1.Status === "2" ? 1 : 0;
        }

        const sipStatus = parseSipStatus(infoResponse)
        const uptimeSeconds = parseUptime(statusResponse)

        return { sipStatus, uptimeSeconds}
    } catch (err) {
        console.error(`Error fetching metrics from device ${url}:  ${err.message}`);
        throw new Error('Failed to fetch metrics from intercom');
    }
}

// Start the server
app.listen(PORT, () => {
    console.log(`Exporter server is running on http://localhost:${PORT}/metrics`);
});
