import { Gauge } from 'prom-client';
import { APP_NAME, SERVICE_PREFIX } from './constants.js'

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

export { createMetrics };