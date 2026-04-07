const { getAPIClient } = require('../../core/api-client');

function formatBytes(bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return bar;
}

function getStatusEmoji(percent) {
    if (percent >= 90) return '🔴';
    if (percent >= 70) return '🟡';
    return '🟢';
}

async function handleStatus(ctx) {
    const { sock, jid, args } = ctx;

    try {
        const api = getAPIClient();
        const { server } = api.parseServerFromArgs(args);
        const serverName = server || ctx.selectedServer;

        const { data } = await api.get(serverName, '/api/monitoring/status');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const s = data.data;
        const srvLabel = serverName ? ` (${serverName})` : '';

        let text = `🖥️ *STATUS SERVER${srvLabel}*\n`;
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        text += `${getStatusEmoji(s.cpu)} *CPU*\n`;
        text += `   Usage: ${s.cpu.toFixed(1)}%\n`;
        text += `   [${getBar(s.cpu)}]\n\n`;

        text += `${getStatusEmoji(s.ram.usedPercent)} *RAM*\n`;
        text += `   ${formatBytes(s.ram.used)} / ${formatBytes(s.ram.total)}\n`;
        text += `   Free: ${formatBytes(s.ram.free)}\n`;
        text += `   Usage: ${s.ram.usedPercent.toFixed(1)}%\n`;
        text += `   [${getBar(s.ram.usedPercent)}]\n\n`;

        if (s.swap.total > 0) {
            text += `${getStatusEmoji(s.swap.usedPercent)} *SWAP*\n`;
            text += `   ${formatBytes(s.swap.used)} / ${formatBytes(s.swap.total)}\n`;
            text += `   Usage: ${s.swap.usedPercent.toFixed(1)}%\n`;
            text += `   [${getBar(s.swap.usedPercent)}]\n\n`;
        }

        if (s.gpu && s.gpu.name !== 'No GPU Detected') {
            text += `🎮 *GPU* (${s.gpu.name})\n`;
            text += `   Busy: ${s.gpu.busyPercent.toFixed(1)}%\n`;
            if (s.gpu.vramTotal > 0) {
                text += `   VRAM: ${formatBytes(s.gpu.vramUsed)} / ${formatBytes(s.gpu.vramTotal)}\n`;
                text += `   [${getBar(s.gpu.vramPercent)}]\n`;
            }
            text += '\n';
        }

        text += `${getStatusEmoji(s.disk.usedPercent)} *DISK*\n`;
        text += `   ${formatBytes(s.disk.used)} / ${formatBytes(s.disk.total)}\n`;
        text += `   Free: ${formatBytes(s.disk.free)}\n`;
        text += `   Usage: ${s.disk.usedPercent.toFixed(1)}%\n`;
        text += `   [${getBar(s.disk.usedPercent)}]\n\n`;

        text += `⏱️ *Uptime*: ${s.uptime}`;

        try {
            const anomalyRes = await api.get(serverName, '/api/monitoring/anomalies');
            if (anomalyRes.data.success && anomalyRes.data.data?.length > 0) {
                text += '\n\n';
                text += '⚠️ *Anomali Terdeteksi*\n';
                for (const a of anomalyRes.data.data) {
                    const icon = a.severity === 'critical' ? '🔴' : '🟡';
                    text += `${icon} ${a.message}\n`;
                }
            }
        } catch (_) {
        }

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal mengambil status server:\n${err.message}`,
        });
    }
}

async function handleServices(ctx) {
    const { sock, jid, args } = ctx;

    try {
        const api = getAPIClient();
        const { server } = api.parseServerFromArgs(args);
        const serverName = server || ctx.selectedServer;

        const { data } = await api.get(serverName, '/api/monitoring/services');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const srvLabel = serverName ? ` (${serverName})` : '';
        let text = `📡 *STATUS SERVICES${srvLabel}*\n`;
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        let runningCount = 0;
        let totalCount = data.data.length;

        for (const svc of data.data) {
            const isRunning = svc.active?.includes('running');
            const icon = isRunning ? '🟢' : '🔴';
            const status = isRunning ? 'running' : svc.active || 'inactive';
            text += `${icon} *${svc.name}*: ${status}\n`;
            if (isRunning) runningCount++;
        }

        text += `\n📊 ${runningCount}/${totalCount} services aktif`;

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal mengambil status services:\n${err.message}`,
        });
    }
}

async function handleAnomaly(ctx) {
    const { sock, jid, args } = ctx;

    try {
        const api = getAPIClient();
        const { server } = api.parseServerFromArgs(args);
        const serverName = server || ctx.selectedServer;

        const { data } = await api.get(serverName, '/api/monitoring/anomalies');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const anomalies = data.data || [];

        if (anomalies.length === 0) {
            await sock.sendMessage(jid, {
                text: '✅ *Tidak Ada Anomali*\n\nSemua metrik dalam kondisi normal.',
            });
            return;
        }

        let text = '⚠️ *Laporan Anomali*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        for (const a of anomalies) {
            const icon = a.severity === 'critical' ? '🔴' : '🟡';
            text += `${icon} *${a.type.toUpperCase()}*\n`;
            text += `   ${a.message}\n`;
            text += `   Saat ini: ${a.value.toFixed(1)}%\n`;
            text += `   Baseline: ${a.baseline.toFixed(1)}%\n`;

            if (a.suggestions && a.suggestions.length > 0) {
                text += '   💡 Rekomendasi:\n';
                for (let i = 0; i < a.suggestions.length; i++) {
                    text += `      ${i + 1}. ${a.suggestions[i]}\n`;
                }
            }
            text += '\n';
        }

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal mengambil data anomali:\n${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleBaseline(ctx) {
    const { sock, jid, args } = ctx;

    try {
        const api = getAPIClient();
        const { server } = api.parseServerFromArgs(args);
        const serverName = server || ctx.selectedServer;

        const { data } = await api.get(serverName, '/api/monitoring/baseline');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const b = data.data;

        let text = '📊 *Baseline Data*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        text += `*CPU*\n`;
        text += `   Rata-rata: ${b.cpu?.average?.toFixed(1) || '-'}%\n`;
        text += `   Std Dev: ${b.cpu?.stddev?.toFixed(1) || '-'}%\n`;
        text += `   Min: ${b.cpu?.min?.toFixed(1) || '-'}%\n`;
        text += `   Max: ${b.cpu?.max?.toFixed(1) || '-'}%\n\n`;

        text += `*RAM*\n`;
        text += `   Rata-rata: ${b.ram?.average?.toFixed(1) || '-'}%\n`;
        text += `   Std Dev: ${b.ram?.stddev?.toFixed(1) || '-'}%\n\n`;

        text += `*Disk*\n`;
        text += `   Rata-rata: ${b.disk?.average?.toFixed(1) || '-'}%\n`;
        text += `   Sampel: ${b.sampleCount || 0}\n\n`;

        text += `⏱️ Window: ${b.windowSize || 60} sampel`;

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal mengambil baseline:\n${err.response?.data?.error || err.message}`,
        });
    }
}

async function handleTrends(ctx) {
    const { sock, jid, args } = ctx;

    try {
        const api = getAPIClient();
        const { server } = api.parseServerFromArgs(args);
        const serverName = server || ctx.selectedServer;

        const { data } = await api.get(serverName, '/api/monitoring/trends');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const t = data.data;

        let text = '📈 *Tren Resource*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        if (t.diskPrediction) {
            const daysLeft = t.diskPrediction.daysUntilFull;
            const icon = daysLeft < 7 ? '🔴' : daysLeft < 30 ? '🟡' : '🟢';
            text += `${icon} *Prediksi Disk Penuh*\n`;
            if (daysLeft > 0 && daysLeft < 365) {
                text += `   Disk diperkirakan penuh dalam ~${daysLeft} hari\n`;
                text += `   Pertumbuhan: ${t.diskPrediction.growthPerDay?.toFixed(2) || '?'} GB/hari\n\n`;
            } else {
                text += `   Pertumbuhan disk stabil, tidak ada risiko.\n\n`;
            }
        }

        if (t.cpuTrend) {
            text += `📊 *Tren CPU (24 jam)*\n`;
            text += `   Naik/turun: ${t.cpuTrend.direction || 'stabil'}\n`;
            text += `   Rata-rata: ${t.cpuTrend.average?.toFixed(1) || '-'}%\n\n`;
        }

        if (t.ramTrend) {
            text += `📊 *Tren RAM (24 jam)*\n`;
            text += `   Naik/turun: ${t.ramTrend.direction || 'stabil'}\n`;
            text += `   Rata-rata: ${t.ramTrend.average?.toFixed(1) || '-'}%\n`;
        }

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal mengambil tren:\n${err.response?.data?.error || err.message}`,
        });
    }
}

module.exports = { handleStatus, handleServices, handleAnomaly, handleBaseline, handleTrends };
