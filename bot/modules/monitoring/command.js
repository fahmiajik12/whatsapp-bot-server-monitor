/**
 * Monitoring Module — Diperluas dengan anomaly, baseline, trends
 */

const { handleStatus, handleServices, handleAnomaly, handleBaseline, handleTrends } = require('./handler');

module.exports = {
    name: 'monitoring',
    commands: [
        {
            name: 'status',
            aliases: ['stat', 'server'],
            description: 'Lihat status server (CPU, RAM, Disk)',
            usage: 'status [server]',
            module: 'monitoring',
            permission: 'user',
            handler: handleStatus,
        },
        {
            name: 'services',
            aliases: ['svc'],
            description: 'Lihat status semua service',
            usage: 'services [server]',
            module: 'monitoring',
            permission: 'user',
            handler: handleServices,
        },
        {
            name: 'anomaly',
            aliases: ['anomali'],
            description: 'Lihat anomali yang terdeteksi',
            usage: 'anomaly [server]',
            module: 'monitoring',
            permission: 'user',
            handler: handleAnomaly,
        },
        {
            name: 'baseline',
            aliases: [],
            description: 'Lihat data baseline monitoring',
            usage: 'baseline [server]',
            module: 'monitoring',
            permission: 'admin',
            handler: handleBaseline,
        },
        {
            name: 'trends',
            aliases: ['trend', 'tren'],
            description: 'Lihat tren resource',
            usage: 'trends [server]',
            module: 'monitoring',
            permission: 'user',
            handler: handleTrends,
        },
    ],
};
