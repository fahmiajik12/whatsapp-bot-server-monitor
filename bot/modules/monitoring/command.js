/**
 * Monitoring Module — Diperluas dengan anomaly, baseline, trends
 */

const { handleStatus, handleServices, handleAnomaly, handleBaseline, handleTrends, handleGraph, handleNetwork, handleLiveStatus, handleStopLive } = require('./handler');

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
        {
            name: 'graph',
            aliases: ['grafik', 'chart'],
            description: 'Lihat grafik tren resource',
            usage: 'graph [server]',
            module: 'monitoring',
            permission: 'user',
            handler: handleGraph,
        },
        {
            name: 'network',
            aliases: ['net', 'bandwidth'],
            description: 'Lihat status trafik jaringan',
            usage: 'network [server]',
            module: 'monitoring',
            permission: 'user',
            handler: handleNetwork,
        },
        {
            name: 'live',
            aliases: ['livestatus'],
            description: 'Lihat live status (Real-time)',
            usage: 'live [server]',
            module: 'monitoring',
            permission: 'user',
            handler: handleLiveStatus,
        },
        {
            name: 'stoplive',
            aliases: [],
            description: 'Hentikan live status',
            usage: 'stoplive',
            module: 'monitoring',
            permission: 'user',
            handler: handleStopLive,
        },
    ],
};
