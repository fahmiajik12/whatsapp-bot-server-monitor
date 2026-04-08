const http = require('http');
const { analyzeSystem, chatWithAI, getAIStatus, getActiveModel, setActiveModel, listModels, invalidateAICache } = require('../../core/ai-engine');
const { getAPIClient } = require('../../core/api-client');
const cache = require('../../core/cache-service');
const { getSessionManager } = require('../../core/session-manager');

async function buildContextData(serverName) {
    const api = getAPIClient();
    const contextData = {};

    try {
        const [statusRes, servicesRes, anomaliesRes] = await Promise.all([
            api.get(serverName, '/api/monitoring/status').catch(() => null),
            api.get(serverName, '/api/monitoring/services').catch(() => null),
            api.get(serverName, '/api/monitoring/anomalies').catch(() => null)
        ]);

        if (statusRes?.data?.success) contextData.status = statusRes.data.data;
        if (servicesRes?.data?.success) contextData.services = servicesRes.data.data;
        if (anomaliesRes?.data?.success) contextData.anomalies = anomaliesRes.data.data;

    } catch (e) {
        console.error('[AI] Fail fetch context', e.message);
    }

    return contextData;
}

async function handleAnalyze(ctx) {
    const { sock, jid, args } = ctx;
    if (!args[0]) {
        await sock.sendMessage(jid, { text: '✍️ Gunakan format: `/analyze <target>`\nContoh: `/analyze cpu`' });
        return;
    }

    const api = getAPIClient();
    const { server, remainingArgs } = api.parseServerFromArgs(args);
    const serverName = server || ctx.selectedServer;
    const target = remainingArgs.join(' ');

    await sock.sendPresenceUpdate('composing', jid);

    const contextData = await buildContextData(serverName);

    if (target.toLowerCase() === 'cpu') {
        try {
            const topRes = await api.get(serverName, '/api/tools/exec/top');
            if (topRes.data?.success) contextData.top_processes = topRes.data.data.output;
        } catch (e) { }
    } else if (target.toLowerCase() === 'disk') {
        try {
            const dfRes = await api.get(serverName, '/api/tools/exec/df');
            if (dfRes.data?.success) contextData.disk_details = dfRes.data.data.output;
        } catch (e) { }
    } else if (target.toLowerCase() === 'ram' || target.toLowerCase() === 'memory') {
        try {
            const freeRes = await api.get(serverName, '/api/tools/exec/free');
            if (freeRes.data?.success) contextData.ram_details = freeRes.data.data.output;
        } catch (e) { }
    }

    const sessions = getSessionManager();
    const history = sessions.getAiHistory(ctx.senderNumber);

    const aiResponse = await analyzeSystem(`Tolong analisa mengenai status ${target} saat ini.`, contextData, { history });
    
    sessions.addAiHistory(ctx.senderNumber, 'user', `Analyze ${target}`);
    sessions.addAiHistory(ctx.senderNumber, 'assistant', aiResponse);

    await sock.sendMessage(jid, { text: aiResponse });
}

async function handleWhy(ctx) {
    const { sock, jid, args } = ctx;
    if (!args[0]) {
        await sock.sendMessage(jid, { text: '✍️ Gunakan format: `/why <issue>`\nContoh: `/why apache down`' });
        return;
    }

    const api = getAPIClient();
    const { server, remainingArgs } = api.parseServerFromArgs(args);
    const serverName = server || ctx.selectedServer;
    const issue = remainingArgs.join(' ');

    await sock.sendPresenceUpdate('composing', jid);

    const contextData = await buildContextData(serverName);
    const aiResponse = await analyzeSystem(`Tolong cari tahu KENAPA terjadi masalah ini: "${issue}"`, contextData);

    await sock.sendMessage(jid, { text: aiResponse });
}

async function handleFix(ctx) {
    const { sock, jid, args } = ctx;
    if (!args[0]) {
        await sock.sendMessage(jid, { text: '✍️ Gunakan format: `/fix <issue>`\nContoh: `/fix ram penuh`' });
        return;
    }

    const api = getAPIClient();
    const { server, remainingArgs } = api.parseServerFromArgs(args);
    const serverName = server || ctx.selectedServer;
    const issue = remainingArgs.join(' ');

    await sock.sendPresenceUpdate('composing', jid);

    const contextData = await buildContextData(serverName);
    const sessions = getSessionManager();
    const history = sessions.getAiHistory(ctx.senderNumber);

    const aiResponse = await analyzeSystem(`Bagaimana CARA FIX atau MEMPERBAIKI masalah ini: "${issue}"`, contextData, { history });

    sessions.addAiHistory(ctx.senderNumber, 'user', `Fix ${issue}`);
    sessions.addAiHistory(ctx.senderNumber, 'assistant', aiResponse);

    await sock.sendMessage(jid, { text: aiResponse });
}

async function handleChat(ctx) {
    const { sock, jid, args } = ctx;
    const text = args.join(' ');
    if (!text) return;

    await sock.sendPresenceUpdate('composing', jid);

    const sessions = getSessionManager();
    const history = sessions.getAiHistory(ctx.senderNumber);

    const aiResponse = await chatWithAI(text, history);

    sessions.addAiHistory(ctx.senderNumber, 'user', text);
    sessions.addAiHistory(ctx.senderNumber, 'assistant', aiResponse);

    await sock.sendMessage(jid, { text: aiResponse });
}

function formatSize(bytes) {
    if (!bytes) return '?';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
}

async function handleAIModel(ctx) {
    const { sock, jid, args } = ctx;
    const subCommand = args[0]?.toLowerCase();

    if (!subCommand || subCommand === 'list' || subCommand === 'status') {
        await sock.sendPresenceUpdate('composing', jid);
        const status = await getAIStatus();
        const models = status.ollama.models || [];

        let text = `🤖 *Wabot AI Status*\n━━━━━━━━━━━━━━━━━━\n`;
        text += `📍 Provider: Ollama (Lokal)\n`;
        text += `🔗 Host: ${status.ollama.host}\n`;
        text += `✅ Status: ${status.ollama.available ? 'Online' : '❌ Offline'}\n`;
        text += `🧠 Model Aktif: *${status.activeModel}*\n\n`;

        if (models.length > 0) {
            text += `📦 *Model Terinstall:*\n`;
            models.forEach((m, i) => {
                const active = m.active ? ' ✅ _(aktif)_' : '';
                text += `${i + 1}. \`${m.name}\` (${formatSize(m.size)})${active}\n`;
            });
            text += `\n💡 Ganti model: \`/aimodel use <nama>\``;
            text += `\n📥 Install model: \`/aimodel pull <nama>\``;
            text += `\n🗑️ Hapus model: \`/aimodel rm <nama>\``;
        } else {
            text += `⚠️ Tidak ada model terinstall.`;
        }

        await sock.sendMessage(jid, { text });
        return;
    }

    if (subCommand === 'use' || subCommand === 'set' || subCommand === 'switch') {
        const modelName = args.slice(1).join(' ');
        if (!modelName) {
            await sock.sendMessage(jid, { text: '✍️ Gunakan format: `/aimodel use <nama_model>`\nContoh: `/aimodel use mistral`' });
            return;
        }

        const models = await listModels();
        const found = models.find(m =>
            m.name === modelName ||
            m.name.startsWith(modelName + ':') ||
            m.name === modelName + ':latest'
        );

        if (!found) {
            const available = models.map(m => `• \`${m.name}\``).join('\n');
            await sock.sendMessage(jid, {
                text: `❌ Model \`${modelName}\` tidak ditemukan.\n\n📦 Model tersedia:\n${available}\n\n💡 Install dulu: \`/aimodel pull ${modelName}\``
            });
            return;
        }

        setActiveModel(found.name);
        await sock.sendMessage(jid, { text: `✅ Model diubah ke *${found.name}* (${formatSize(found.size)})\n\n🧪 Coba kirim pesan untuk test!` });
        return;
    }

    if (subCommand === 'pull' || subCommand === 'install' || subCommand === 'download') {
        const modelName = args.slice(1).join(' ');
        if (!modelName) {
            await sock.sendMessage(jid, { text: '✍️ Gunakan format: `/aimodel pull <nama_model>`\nContoh: `/aimodel pull gemma2:2b`\n\n📋 Model populer:\n• `qwen2.5:0.5b` (397 MB)\n• `qwen2.5:1.5b` (986 MB)\n• `gemma2:2b` (1.6 GB)\n• `phi3:mini` (2.3 GB)\n• `llama3.2:3b` (2.0 GB)\n• `mistral` (4.1 GB)\n• `qwen2.5:7b` (4.7 GB)' });
            return;
        }

        await sock.sendMessage(jid, { text: `⏳ Mendownload model *${modelName}*...\nIni bisa memakan waktu beberapa menit, mohon tunggu.` });

        try {
            const result = await pullModel(modelName);
            if (result.success) {
                await sock.sendMessage(jid, { text: `✅ Model *${modelName}* berhasil didownload!\n\n💡 Gunakan: \`/aimodel use ${modelName}\`` });
            } else {
                await sock.sendMessage(jid, { text: `❌ Gagal download: ${result.error}` });
            }
        } catch (err) {
            await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
        }
        return;
    }

    if (subCommand === 'rm' || subCommand === 'remove' || subCommand === 'delete' || subCommand === 'uninstall') {
        const modelName = args.slice(1).join(' ');
        if (!modelName) {
            await sock.sendMessage(jid, { text: '✍️ Format: `/aimodel rm <nama_model>`' });
            return;
        }

        if (modelName === getActiveModel()) {
            await sock.sendMessage(jid, { text: '❌ Tidak bisa menghapus model yang sedang aktif.\nGanti model dulu: `/aimodel use <model_lain>`' });
            return;
        }

        try {
            await deleteModel(modelName);
            await sock.sendMessage(jid, { text: `✅ Model *${modelName}* berhasil dihapus.` });
        } catch (err) {
            await sock.sendMessage(jid, { text: `❌ Gagal hapus: ${err.message}` });
        }
        return;
    }

    await sock.sendMessage(jid, {
        text: `🤖 *AI Model Manager*\n━━━━━━━━━━━━━━━━━━\n\n` +
            `/aimodel — Status & daftar model\n` +
            `/aimodel use <nama> — Ganti model aktif\n` +
            `/aimodel pull <nama> — Download model baru\n` +
            `/aimodel rm <nama> — Hapus model`
    });
}

function pullModel(modelName) {
    const ollamaConfig = require('../../config.json').ollama || {};
    const host = ollamaConfig.host || 'localhost';
    const port = ollamaConfig.port || 11434;

    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ name: modelName, stream: false });

        const options = {
            hostname: host,
            port: port,
            path: '/api/pull',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 600000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        resolve({ success: false, error: parsed.error });
                    } else {
                        resolve({ success: true });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'Response parse error' });
                }
            });
        });

        req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout (10 menit)')); });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function deleteModel(modelName) {
    const ollamaConfig = require('../../config.json').ollama || {};
    const host = ollamaConfig.host || 'localhost';
    const port = ollamaConfig.port || 11434;

    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ name: modelName });

        const options = {
            hostname: host,
            port: port,
            path: '/api/delete',
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 30000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve());
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function handleCacheStats(ctx) {
    const { sock, jid, args } = ctx;
    const subCommand = args[0]?.toLowerCase();

    if (subCommand === 'clear' || subCommand === 'flush' || subCommand === 'hapus') {
        await sock.sendPresenceUpdate('composing', jid);

        const deleted = await invalidateAICache();
        cache.resetStats();

        await sock.sendMessage(jid, {
            text: `🗑️ *Cache Cleared*\n━━━━━━━━━━━━━━━━━━\n\n` +
                `✅ ${deleted} cache entries dihapus\n` +
                `✅ Statistik direset\n\n` +
                `💡 Cache akan terisi kembali saat ada request baru.`
        });
        return;
    }

    await sock.sendPresenceUpdate('composing', jid);
    const stats = await cache.getStats();

    let text = `📊 *Cache Statistics*\n━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📍 Redis: ${stats.connected ? '✅ Connected' : '❌ Disconnected'}\n`;
    text += `🔗 Host: ${stats.redis.host}\n`;
    text += `💾 Memory: ${stats.redis.memoryUsage}\n`;
    text += `🔑 Total Keys: ${stats.redis.totalKeys}\n\n`;

    text += `📈 *Hit/Miss Stats*\n`;
    text += `✅ Hits: ${stats.hits}\n`;
    text += `❌ Misses: ${stats.misses}\n`;
    text += `📊 Hit Rate: ${stats.hitRate}\n`;
    text += `⚠️ Errors: ${stats.errors}\n`;
    text += `⏳ In-Flight: ${stats.inFlight}\n`;
    text += `⏱️ Uptime: ${stats.uptimeMinutes} menit\n\n`;

    text += `⏰ *TTL Settings*\n`;
    text += `• AI Chat: ${stats.ttl.aiChat}s\n`;
    text += `• AI DevOps: ${stats.ttl.aiDevops}s\n`;
    text += `• AI Intent: ${stats.ttl.aiIntent}s\n`;
    text += `• Monitoring: ${stats.ttl.monitoring}s\n\n`;

    text += `💡 Clear cache: \`/cache clear\``;

    await sock.sendMessage(jid, { text });
}


module.exports = {
    handleAnalyze,
    handleWhy,
    handleFix,
    handleChat,
    handleAIModel,
    handleCacheStats
};
