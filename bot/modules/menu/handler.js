const { getMenuEngine } = require('../../core/menu-engine');
const { getSessionManager } = require('../../core/session-manager');
const { getAPIClient } = require('../../core/api-client');

async function handleMenu(ctx) {
    const { sock, jid, senderNumber } = ctx;
    const menuEngine = getMenuEngine();
    const text = menuEngine.openMenu(senderNumber, 'main');
    await sock.sendMessage(jid, { text });
}

async function handleHome(ctx) {
    const { sock, jid, senderNumber } = ctx;
    const menuEngine = getMenuEngine();
    const sessions = getSessionManager();
    sessions.goHome(senderNumber);
    const text = menuEngine.openMenu(senderNumber, 'main');
    await sock.sendMessage(jid, { text });
}

async function handleServers(ctx) {
    const { sock, jid, senderNumber } = ctx;

    try {
        const apiClient = getAPIClient();
        const servers = apiClient.listServers();
        const sessions = getSessionManager();
        const selectedServer = sessions.getServer(senderNumber);

        let text = '🖥️ *Daftar Server*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        for (const srv of servers) {
            const isSelected = (selectedServer === srv.id) || (!selectedServer && srv.isDefault);
            const icon = isSelected ? '✅' : '⬜';
            const defaultTag = srv.isDefault ? ' _(default)_' : '';
            const localTag = srv.isLocal ? ' 📍local' : ' 🌐remote';
            text += `${icon} *${srv.name}* [${srv.id}]${defaultTag}${localTag}\n`;
            text += `   URL: ${srv.url}\n\n`;
        }

        text += '━━━━━━━━━━━━━━━━━━\n';
        text += '💡 Gunakan nama server di command:\n';
        text += '   /status staging\n';
        text += '   /restart apache2 prod';

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Gagal memuat daftar server: ${err.message}` });
    }
}

module.exports = { handleMenu, handleHome, handleServers };
