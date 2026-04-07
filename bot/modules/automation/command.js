const { handleAutoList, handleAutoEnable, handleAutoDisable, handleAutoHistory } = require('./handler');

module.exports = {
    name: 'automation',
    commands: [
        { name: 'auto', aliases: ['automation'], description: 'Lihat daftar aturan automation', usage: 'auto', module: 'automation', permission: 'admin', handler: handleAutoList },
        { name: 'auto enable', aliases: [], description: 'Aktifkan aturan automation', usage: 'auto enable <id>', module: 'automation', permission: 'admin', handler: handleAutoEnable },
        { name: 'auto disable', aliases: [], description: 'Nonaktifkan aturan automation', usage: 'auto disable <id>', module: 'automation', permission: 'admin', handler: handleAutoDisable },
        { name: 'auto history', aliases: ['auto log'], description: 'Riwayat eksekusi automation', usage: 'auto history', module: 'automation', permission: 'admin', handler: handleAutoHistory },
    ],
};
