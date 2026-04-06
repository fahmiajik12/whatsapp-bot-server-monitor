const axios = require('axios');
const config = require('../../config.json');

const api = axios.create({
    baseURL: config.backendUrl,
    headers: { 'X-API-Key': config.apiKey },
    timeout: 15000,
});

async function handleService(ctx) {
    const { sock, jid, args } = ctx;
    const name = args[0];

    if (!name) {
        await sock.sendMessage(jid, {
            text: '[i] *Penggunaan:* /service <nama>\n\nContoh: /service apache2',
        });
        return;
    }

    try {
        const { data } = await api.get(`/api/service/${name}`);

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Error: ${data.error}` });
            return;
        }

        const s = data.data;
        const isRunning = s.active?.includes('running');
        const icon = isRunning ? '[+]' : '[-]';

        await sock.sendMessage(jid, {
            text:
                `${icon} *Service: ${s.name}*\n\n` +
                `- Status: ${s.active}\n` +
                `- Loaded: ${s.loadState || '-'}`,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal: ${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleStart(ctx) {
    await serviceAction(ctx, 'start', '[>]');
}

async function handleStop(ctx) {
    await serviceAction(ctx, 'stop', '[x]');
}

async function handleRestart(ctx) {
    await serviceAction(ctx, 'restart', '[~]');
}

async function serviceAction(ctx, action, icon) {
    const { sock, jid, args } = ctx;
    const name = args[0];

    if (!name) {
        await sock.sendMessage(jid, {
            text: `[i] *Penggunaan:* /${action} <nama>\n\nContoh: /${action} apache2`,
        });
        return;
    }

    try {
        await sock.sendMessage(jid, {
            text: `${icon} *${action.toUpperCase()}* service: ${name}...`,
        });

        const { data } = await api.post(`/api/service/${name}/${action}`);

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Gagal: ${data.error}` });
            return;
        }

        await sock.sendMessage(jid, {
            text: `[+] *${name}* berhasil di-${action}`,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal ${action} ${name}: ${err.response?.data?.error || err.message}`,
        });
    }
}

module.exports = { handleService, handleStart, handleStop, handleRestart };
