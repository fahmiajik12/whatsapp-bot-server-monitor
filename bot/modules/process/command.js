const { handleKill } = require('./handler');

module.exports = {
    name: 'process',
    commands: [
        {
            name: 'kill',
            aliases: [],
            description: 'Kill proses berdasarkan PID',
            usage: 'kill <pid>',
            module: 'process',
            permission: 'admin',
            handler: handleKill,
        },
    ],
};
