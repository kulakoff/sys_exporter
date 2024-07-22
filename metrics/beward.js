import axios from "axios";

export const getBewardMetrics = async (url, username = 'admin', password) => {
    console.log("RUN getBewardMetrics > " + url );
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

