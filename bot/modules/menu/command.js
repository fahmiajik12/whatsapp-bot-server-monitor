const { handleMenu, handleHome, handleServers } = require('./handler');

module.exports = {
    name: 'menu',
    commands: [
        { name: 'menu', aliases: ['m'], description: 'Buka menu interaktif', usage: 'menu', module: 'menu', permission: 'user', handler: handleMenu },
        { name: 'home', aliases: [], description: 'Kembali ke menu utama', usage: 'home', module: 'menu', permission: 'user', handler: handleHome },
        { name: 'servers', aliases: ['server'], description: 'Daftar server yang terdaftar', usage: 'servers', module: 'menu', permission: 'user', handler: handleServers },
    ],
};
