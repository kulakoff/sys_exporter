// device specific metrics
import { AKUVOX, BEWARD_DKS, BEWARD_DS, QTECH } from "../constants.js";

import { getQtechMetrics } from './qtech.js'
import { getAkuvoxMetrics } from './akuvox.js'
import { getBewardMetrics } from './beward.js'

export const getMetrics = async ({url, username, password, model}) => {
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