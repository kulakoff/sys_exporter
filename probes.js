import { createMetrics } from './metrics.js';
import { getMetrics } from './metrics/index.js';
import { Registry } from 'prom-client';
import { APP_NAME } from "./constants.js";

export const handleProbeRequest = async (req, res, globalRegistry, globalMetrics) => {
    const { url, username, password, model } = req.query;

    if (!url || !username || !password || !model) {
        return res.status(400).send('Отсутствуют необходимые параметры запроса: url, username, password, model');
    }

    const requestRegistry = new Registry();
    requestRegistry.setDefaultLabels({ app: APP_NAME });

    const { sipStatusGauge, uptimeGauge, probeSuccess } = createMetrics([requestRegistry]);

    try {
        const { sipStatus, uptimeSeconds } = await getMetrics({ url, username, password, model });

        sipStatusGauge.set({ url }, sipStatus);
        uptimeGauge.set({ url }, uptimeSeconds);
        probeSuccess.set({ url }, 1);

        globalMetrics.sipStatusGauge.set({ url }, sipStatus);
        globalMetrics.uptimeGauge.set({ url }, uptimeSeconds);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());

    } catch (error) {
        console.error('Не удалось обновить метрики:', error.message);
        probeSuccess.set({ url }, 0);

        res.set('Content-Type', requestRegistry.contentType);
        res.send(await requestRegistry.metrics());
    } finally {
        requestRegistry.clear();
    }
};
