import express from "express";
import { Gauge, Registry } from "prom-client";
import { APP_NAME, AUTH_ENABLED, AUTH_PASS, AUTH_USER, SERVICE_PREFIX } from "../constants.js";
import { getMetrics } from "../utils/metrics.js";
import {createMetrics} from "../metrics/metricsFactory.js"
import basicAuthMiddleware from "../middleware/auth.js";
import { globalRegistry } from "../metrics/registry.js";
import metricsRoute from "./metrics.js"

const router = express.Router();

// FIXME: not used global metrics
// Create global metrics
// const {
//     sipStatusGauge: globalSipStatusGauge,
//     uptimeGauge: globalUptimeGauge,
// } = createMetrics([globalRegistry], true);

// auth
if (AUTH_ENABLED === true) {
    console.log("AUTH ENABLED");
    console.log(AUTH_ENABLED, AUTH_USER, AUTH_PASS);
    router.use(basicAuthMiddleware);
}
router.get("/123", (req, res)=>{
    res.end("123")
})
router.use('/metrics', metricsRoute);
router.get('/probe', async (req, res) => {
    const {url, username, password, model} = req.query;
    if (!url || !username || !password || !model) {
        return res.status(400).send('Missing required query parameters: url, username, password or model');
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
        // get device status data
        const { sipStatus, uptimeSeconds } = await getMetrics({url, username, password, model});

        // Update metrics per request-specific
        requestSipStatusGauge.set({url}, sipStatus);
        requestUptimeGauge.set({url}, uptimeSeconds);
        requestProbeSuccessGauge.set({url}, 1);

        // TODO: not usage global registry
        //  update  global registry
        globalSipStatusGauge.set({url}, sipStatus);
        globalUptimeGauge.set({url}, uptimeSeconds);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());
        requestRegistry.clear();
    } catch (error) {
        console.error('Failed to update metrics:', error.message);
        requestProbeSuccessGauge.set({url}, 0);
        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());
        requestRegistry.clear();
    }
});

export default router;