const axios = require('axios');
const config = require('../../config.json');

const api = axios.create({
    baseURL: config.backendUrl,
    headers: { 'X-API-Key': config.apiKey },
    timeout: 15000,
});

async function handleWebStatus(ctx) {
    const { sock, jid } = ctx;

    try {
        const { data } = await api.get('/api/apache/status');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Error: ${data.error}` });
            return;
        }

        const s = data.data;
        const isRunning = s.active?.includes('running');
        const icon = isRunning ? '[+]' : '[-]';

        await sock.sendMessage(jid, {
            text:
                `*APACHE STATUS*\n\n` +
                `${icon} Status: ${s.active}\n` +
                `- Service: ${s.name}\n` +
                `- Loaded: ${s.loadState || '-'}`,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal: ${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleWebRestart(ctx) {
    const { sock, jid } = ctx;

    try {
        await sock.sendMessage(jid, { text: '[~] *Restarting Apache...*' });
        const { data } = await api.post('/api/apache/restart');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Gagal: ${data.error}` });
            return;
        }

        await sock.sendMessage(jid, { text: '[+] *Apache berhasil di-restart*' });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal restart Apache: ${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleWebReload(ctx) {
    const { sock, jid } = ctx;

    try {
        await sock.sendMessage(jid, { text: '[~] *Reloading Apache config...*' });
        const { data } = await api.post('/api/apache/reload');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Gagal: ${data.error}` });
            return;
        }

        await sock.sendMessage(jid, { text: '[+] *Apache config berhasil di-reload*' });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal reload Apache: ${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleWebConfigTest(ctx) {
    const { sock, jid } = ctx;

    try {
        const { data } = await api.get('/api/apache/configtest');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Config test gagal:\n${data.error}` });
            return;
        }

        const result = data.data.result || 'Syntax OK';
        const isOk = result.toLowerCase().includes('syntax ok');

        await sock.sendMessage(jid, {
            text:
                `*APACHE CONFIG TEST*\n\n` +
                `${isOk ? '[+]' : '[!]'} ${result}`,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal: ${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleWebVHost(ctx) {
    const { sock, jid } = ctx;

    try {
        const { data } = await api.get('/api/apache/vhost');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Error: ${data.error}` });
            return;
        }

        const vhosts = data.data.vhosts || 'Tidak ada data';

        await sock.sendMessage(jid, {
            text: `*VIRTUAL HOSTS*\n\n\`\`\`\n${vhosts}\n\`\`\``,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal: ${err.response?.data?.error || err.message}`,
        });
    }
}

module.exports = {
    handleWebStatus,
    handleWebRestart,
    handleWebReload,
    handleWebConfigTest,
    handleWebVHost,
};
