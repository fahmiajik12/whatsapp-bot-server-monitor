const config = require('../config.json');
const { dispatcher } = require('./dispatcher');
const { getAuthStore } = require('../modules/auth/store');

async function router(sock, msg, text) {
    const prefix = config.prefix || '/';

    if (!text.startsWith(prefix)) return;

    const withoutPrefix = text.slice(prefix.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    if (!command) return;

    const jid = msg.key.remoteJid;
    const isGroup = jid?.endsWith('@g.us');
    const senderJid = isGroup ? msg.key.participant : jid;

    let senderNumber = '';

    if (senderJid?.endsWith('@lid')) {
        const lidNumber = senderJid.replace('@lid', '');
        senderNumber = resolveLID(lidNumber, sock) || lidNumber;
    } else {
        senderNumber = senderJid?.replace('@s.whatsapp.net', '') || '';
    }

    console.log(`[DEBUG] JID: ${senderJid} -> Number: ${senderNumber}`);

    const authStore = getAuthStore();
    let userRole = authStore.getRole(senderNumber);

    if (!userRole && senderJid?.endsWith('@lid')) {
        const lidNumber = senderJid.replace('@lid', '');
        const allUsers = authStore.listUsers();
        for (const [num, role] of Object.entries(allUsers)) {
            if (num === lidNumber) {
                userRole = role;
                break;
            }
        }

        if (!userRole) {
            const lidMap = getLIDMapping(sock);
            for (const [lid, phone] of Object.entries(lidMap)) {
                const r = authStore.getRole(phone);
                if (r && lid === lidNumber) {
                    userRole = r;
                    senderNumber = phone;
                    break;
                }
            }
        }
    }

    if (!userRole) {
        console.log(`[WARN] Nomor tidak terdaftar: ${senderNumber} (JID: ${senderJid})`);

        await sock.sendMessage(jid, {
            text: `[x] *Akses Ditolak*\n\nNomor ${senderNumber} tidak terdaftar.\nJID: ${senderJid}\n\nHubungi admin atau tambahkan nomor/LID ke config.`,
        });
        return;
    }

    const ctx = {
        sock,
        msg,
        jid,
        senderNumber,
        senderRole: userRole,
        isGroup,
        command,
        args,
        text: withoutPrefix,
    };

    const senderName = msg.pushName || senderNumber;
    console.log(
        `[CMD] [${formatRole(userRole)}] ${senderName} (${senderNumber}): ${prefix}${command} ${args.join(' ')}`
    );

    await dispatcher(ctx);
}

function resolveLID(lid, sock) {
    try {
        const store = sock?.authState?.creds;
        if (store?.me?.id) {
            const myNumber = store.me.id.replace(/@.*/, '').replace(/:\d+$/, '');
            if (store.me.lid && store.me.lid.includes(lid)) {
                return myNumber;
            }
        }
    } catch (e) {}
    return null;
}

function getLIDMapping(sock) {
    const mapping = {};
    try {
        const store = sock?.authState?.creds;
        if (store?.me) {
            const num = store.me.id.replace(/@.*/, '').replace(/:\d+$/, '');
            const lid = store.me.lid?.replace(/@.*/, '') || '';
            if (lid) mapping[lid] = num;
        }
    } catch (e) {}
    return mapping;
}

function formatRole(role) {
    const icons = {
        superadmin: 'SA',
        admin: 'ADM',
        user: 'USR',
    };
    return `${icons[role] || '?'} ${role}`;
}

module.exports = { router };
