const {
    handleWebStatus,
    handleWebRestart,
    handleWebReload,
    handleWebConfigTest,
    handleWebVHost,
} = require('./handler');

module.exports = {
    name: 'apache',
    commands: [
        {
            name: 'web status',
            aliases: ['web'],
            description: 'Status Apache',
            usage: 'web status',
            module: 'apache',
            permission: 'admin',
            handler: handleWebStatus,
        },
        {
            name: 'web restart',
            aliases: [],
            description: 'Restart Apache',
            usage: 'web restart',
            module: 'apache',
            permission: 'admin',
            handler: handleWebRestart,
        },
        {
            name: 'web reload',
            aliases: [],
            description: 'Reload Apache config',
            usage: 'web reload',
            module: 'apache',
            permission: 'admin',
            handler: handleWebReload,
        },
        {
            name: 'web configtest',
            aliases: ['web test'],
            description: 'Test konfigurasi Apache',
            usage: 'web configtest',
            module: 'apache',
            permission: 'admin',
            handler: handleWebConfigTest,
        },
        {
            name: 'web vhost',
            aliases: ['web vhosts'],
            description: 'Daftar virtual host',
            usage: 'web vhost',
            module: 'apache',
            permission: 'admin',
            handler: handleWebVHost,
        },
    ],
};
