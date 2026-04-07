const { handleSettings, handleSettingsUpdate, handleAudit } = require('./handler');

module.exports = {
    name: 'settings',
    commands: [
        {
            name: 'settings',
            aliases: ['config', 'cfg'],
            description: 'Lihat konfigurasi saat ini',
            usage: 'settings',
            module: 'settings',
            permission: 'admin',
            handler: handleSettings,
        },
        {
            name: 'settings set',
            aliases: ['config set'],
            description: 'Ubah pengaturan',
            usage: 'settings set <key> <value>',
            module: 'settings',
            permission: 'superadmin',
            handler: handleSettingsUpdate,
        },
        {
            name: 'audit',
            aliases: ['auditlog'],
            description: 'Lihat audit log',
            usage: 'audit [count]',
            module: 'settings',
            permission: 'admin',
            handler: handleAudit,
        },
    ],
};
