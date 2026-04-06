const axios = require('axios');
const config = require('../../config.json');

const api = axios.create({
    baseURL: config.backendUrl,
    headers: { 'X-API-Key': config.apiKey },
    timeout: 15000,
});

function formatBytes(bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '|'.repeat(filled) + '.'.repeat(empty);
}

async function handleStatus(ctx) {
    const { sock, jid } = ctx;

    try {
        const { data } = await api.get('/api/monitoring/status');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Error: ${data.error}` });
            return;
        }

        const s = data.data;
        const cpuBar = getBar(s.cpu);
        const ramBar = getBar(s.ram.usedPercent);
        const swapBar = getBar(s.swap.usedPercent);
        const diskBar = getBar(s.disk.usedPercent);

        let text =
            `*STATUS SERVER*\n\n` +
            `*CPU*\n` +
            `- Usage: ${s.cpu.toFixed(1)}%\n` +
            `- [${cpuBar}]\n\n` +
            `*RAM*\n` +
            `- Used: ${formatBytes(s.ram.used)} / ${formatBytes(s.ram.total)}\n` +
            `- Free: ${formatBytes(s.ram.free)}\n` +
            `- Usage: ${s.ram.usedPercent.toFixed(1)}%\n` +
            `- [${ramBar}]\n\n` +
            `*SWAP*\n` +
            `- Used: ${formatBytes(s.swap.used)} / ${formatBytes(s.swap.total)}\n` +
            `- Free: ${formatBytes(s.swap.free)}\n` +
            `- Usage: ${s.swap.usedPercent.toFixed(1)}%\n` +
            `- [${swapBar}]\n\n`;

        if (s.gpu && s.gpu.name !== 'No GPU Detected') {
            const vramBar = getBar(s.gpu.vramPercent || 0);
            text +=
                `*GPU* (${s.gpu.name})\n` +
                `- GPU Busy: ${s.gpu.busyPercent.toFixed(1)}%\n`;

            if (s.gpu.vramTotal > 0) {
                text +=
                    `- VRAM Used: ${formatBytes(s.gpu.vramUsed)} / ${formatBytes(s.gpu.vramTotal)}\n` +
                    `- VRAM Free: ${formatBytes(s.gpu.vramFree)}\n` +
                    `- VRAM Usage: ${s.gpu.vramPercent.toFixed(1)}%\n` +
                    `- [${vramBar}]\n\n`;
            } else {
                text += '\n';
            }
        }

        text +=
            `*DISK*\n` +
            `- Used: ${formatBytes(s.disk.used)} / ${formatBytes(s.disk.total)}\n` +
            `- Free: ${formatBytes(s.disk.free)}\n` +
            `- Usage: ${s.disk.usedPercent.toFixed(1)}%\n` +
            `- [${diskBar}]\n\n` +
            `*Uptime*: ${s.uptime}`;

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal mengambil status server:\n${err.message}`,
        });
    }
}

async function handleServices(ctx) {
    const { sock, jid } = ctx;

    try {
        const { data } = await api.get('/api/monitoring/services');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Error: ${data.error}` });
            return;
        }

        let text = '*STATUS SERVICES*\n\n';

        for (const svc of data.data) {
            const isRunning = svc.active?.includes('running');
            const icon = isRunning ? '[+]' : '[-]';
            const status = isRunning ? 'running' : svc.active || 'inactive';
            text += `${icon} *${svc.name}*: ${status}\n`;
        }

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `[!] Gagal mengambil status services:\n${err.message}`,
        });
    }
}

module.exports = { handleStatus, handleServices };
