const { handleStatus, handleServices } = require('./handler');

module.exports = {
    name: 'monitoring',
    commands: [
        {
            name: 'status',
            aliases: ['stat', 'server'],
            description: 'Lihat status server (CPU, RAM, Disk)',
            usage: 'status',
            module: 'monitoring',
            permission: 'user',
            handler: handleStatus,
        },
        {
            name: 'services',
            aliases: ['svc'],
            description: 'Lihat status semua service',
            usage: 'services',
            module: 'monitoring',
            permission: 'user',
            handler: handleServices,
        },
    ],
};
