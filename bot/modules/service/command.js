const { handleService, handleStart, handleStop, handleRestart } = require('./handler');

module.exports = {
    name: 'service',
    commands: [
        {
            name: 'service',
            aliases: [],
            description: 'Lihat status service',
            usage: 'service <nama>',
            module: 'service',
            permission: 'admin',
            handler: handleService,
        },
        {
            name: 'start',
            aliases: [],
            description: 'Start service',
            usage: 'start <nama>',
            module: 'service',
            permission: 'admin',
            handler: handleStart,
        },
        {
            name: 'stop',
            aliases: [],
            description: 'Stop service',
            usage: 'stop <nama>',
            module: 'service',
            permission: 'admin',
            handler: handleStop,
        },
        {
            name: 'restart',
            aliases: [],
            description: 'Restart service',
            usage: 'restart <nama>',
            module: 'service',
            permission: 'admin',
            handler: handleRestart,
        },
    ],
};
