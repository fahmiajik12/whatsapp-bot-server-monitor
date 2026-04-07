const { handleAddUser, handleRemoveUser, handleListUsers } = require('./handler');

module.exports = {
    name: 'auth',
    commands: [
        {
            name: 'adduser',
            aliases: ['useradd'],
            description: 'Tambah user ke whitelist',
            usage: 'adduser <nomor> [role]',
            module: 'auth',
            permission: 'superadmin',
            handler: handleAddUser,
        },
        {
            name: 'removeuser',
            aliases: ['userdel', 'deluser'],
            description: 'Hapus user dari whitelist',
            usage: 'removeuser <nomor>',
            module: 'auth',
            permission: 'superadmin',
            handler: handleRemoveUser,
        },
        {
            name: 'listusers',
            aliases: ['users', 'whitelist'],
            description: 'Daftar user yang terdaftar',
            usage: 'listusers',
            module: 'auth',
            permission: 'admin',
            handler: handleListUsers,
        },
    ],
};
