const { getAPIClient } = require('../../core/api-client');

async function handleService(ctx) {
    const { sock, jid, args } = ctx;
    const api = getAPIClient();
    const { target, server } = api.parseServerFromArgs(args);
    const serverName = server || ctx.selectedServer;
    const name = target;

    if (!name) {
        await sock.sendMessage(jid, {
            text: '📝 *Penggunaan:* /service <nama>\n\nContoh: /service apache2',
        });
        return;
    }

    try {
        const { data } = await api.get(serverName, `/api/service/${name}`);

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const s = data.data;
        const isRunning = s.active?.includes('running');
        const icon = isRunning ? '🟢' : '🔴';
        const srvLabel = serverName ? ` (${serverName})` : '';

        let text = `${icon} *Service: ${s.name}*${srvLabel}\n`;
        text += '━━━━━━━━━━━━━━━━━━\n\n';
        text += `📊 Status: ${s.active}\n`;
        text += `📦 Loaded: ${s.loadState || '-'}\n`;
        text += `🔄 SubState: ${s.subState || '-'}\n`;

        if (!isRunning) {
            text += '\n💡 *Aksi:*\n';
            text += `  /start ${name} — Nyalakan service\n`;
            text += `  /restart ${name} — Restart service`;
        }

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal: ${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleStart(ctx) {
    await serviceAction(ctx, 'start', '▶️');
}

async function handleStop(ctx) {
    await serviceAction(ctx, 'stop', '⏹️');
}

async function handleRestart(ctx) {
    await serviceAction(ctx, 'restart', '🔄');
}

async function serviceAction(ctx, action, icon) {
    const { sock, jid, args } = ctx;
    const api = getAPIClient();
    const { target, server } = api.parseServerFromArgs(args);
    const serverName = server || ctx.selectedServer;
    const name = target;

    if (!name) {
        await sock.sendMessage(jid, {
            text: `📝 *Penggunaan:* /${action} <nama>\n\nContoh: /${action} apache2`,
        });
        return;
    }

    try {
        const srvLabel = serverName ? ` (${serverName})` : '';
        await sock.sendMessage(jid, {
            text: `${icon} *${action.toUpperCase()}* service: ${name}${srvLabel}...`,
        });

        const { data } = await api.post(serverName, `/api/service/${name}/${action}`);

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Gagal: ${data.error}` });
            return;
        }

        await sock.sendMessage(jid, {
            text: `✅ *${name}* berhasil di-${action}${srvLabel}`,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal ${action} ${name}: ${err.response?.data?.error || err.message}`,
        });
    }
}

module.exports = { handleService, handleStart, handleStop, handleRestart };
