const axios = require('axios');
const config = require('../../config.json');

const api = axios.create({
    baseURL: config.backendUrl,
    headers: { 'X-API-Key': config.apiKey },
    timeout: 15000,
});

async function handleKill(ctx) {
    const { sock, jid, args } = ctx;
    const pid = args[0];

    if (!pid) {
        await sock.sendMessage(jid, {
            text: '[i] *Penggunaan:* /kill <pid>\n\nContoh: /kill 12345',
        });
        return;
    }

    if (!/^\d+$/.test(pid)) {
        await sock.sendMessage(jid, {
            text: '[!] PID harus berupa angka',
        });
        return;
    }

    try {
        await sock.sendMessage(jid, {
            text: `[~] *Killing proses PID ${pid}...*`,
        });

        const { data } = await api.post(`/api/process/kill/${pid}`);

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Gagal: ${data.error}` });
            return;
        }

        await sock.sendMessage(jid, {
            text: `[+] *Proses PID ${pid} berhasil dihentikan*`,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal kill PID ${pid}: ${err.response?.data?.error || err.message}`,
        });
    }
}

module.exports = { handleKill };
