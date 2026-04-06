const { getAuthStore } = require('./store');

async function handleAddUser(ctx) {
    const { sock, jid, args } = ctx;
    const number = args[0];
    const role = args[1] || 'user';

    if (!number) {
        await sock.sendMessage(jid, {
            text: '[i] *Penggunaan:* /adduser <nomor> [role]\n\nRole: user, admin\nContoh: /adduser 628123456789 admin',
        });
        return;
    }

    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
        await sock.sendMessage(jid, {
            text: `[!] Role tidak valid: ${role}\nRole yang tersedia: ${validRoles.join(', ')}`,
        });
        return;
    }

    if (!/^62\d{9,13}$/.test(number)) {
        await sock.sendMessage(jid, {
            text: '[!] Format nomor tidak valid.\nGunakan format: 628xxxxxxxxxx',
        });
        return;
    }

    const store = getAuthStore();
    store.addUser(number, role);

    await sock.sendMessage(jid, {
        text: `[+] *User ditambahkan*\n\n- Nomor: ${number}\n- Role: ${role}`,
    });
}

async function handleRemoveUser(ctx) {
    const { sock, jid, args } = ctx;
    const number = args[0];

    if (!number) {
        await sock.sendMessage(jid, {
            text: '[i] *Penggunaan:* /removeuser <nomor>\n\nContoh: /removeuser 628123456789',
        });
        return;
    }

    const store = getAuthStore();
    const result = store.removeUser(number);

    if (!result) {
        await sock.sendMessage(jid, {
            text: '[!] Tidak bisa menghapus admin yang dikonfigurasi di config.json',
        });
        return;
    }

    await sock.sendMessage(jid, {
        text: `[+] *User dihapus*: ${number}`,
    });
}

async function handleListUsers(ctx) {
    const { sock, jid } = ctx;
    const store = getAuthStore();
    const users = store.listUsers();

    const roleIcons = {
        superadmin: '[SA]',
        admin: '[ADM]',
        user: '[USR]',
    };

    let text = '*DAFTAR USER*\n\n';

    for (const [number, role] of Object.entries(users)) {
        const icon = roleIcons[role] || '[?]';
        text += `${icon} ${number} -- *${role}*\n`;
    }

    if (Object.keys(users).length === 0) {
        text += '_Tidak ada user terdaftar_';
    }

    await sock.sendMessage(jid, { text });
}

module.exports = { handleAddUser, handleRemoveUser, handleListUsers };
