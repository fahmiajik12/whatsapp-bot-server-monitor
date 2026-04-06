const axios = require('axios');
const config = require('../../config.json');

const api = axios.create({
    baseURL: config.backendUrl,
    headers: { 'X-API-Key': config.apiKey },
    timeout: 20000,
});

async function runTool(ctx, toolName, title) {
    const { sock, jid } = ctx;

    try {
        const { data } = await api.get(`/api/tools/exec/${toolName}`);

        if (!data.success) {
            await sock.sendMessage(jid, { text: `[!] Error: ${data.error}` });
            return;
        }

        let output = data.data.output || 'Tidak ada output';
        if (output.length > 3000) {
            output = output.substring(0, 3000) + '\n... (output dipotong)';
        }

        await sock.sendMessage(jid, {
            text: `*${title}*\n\n\`\`\`\n${output}\n\`\`\``,
        });
    } catch (err) {
        const errMsg = err.response?.data?.error || err.message;
        await sock.sendMessage(jid, { text: `[!] Gagal: ${errMsg}` });
    }
}

async function handlePm2(ctx) {
    await runTool(ctx, 'pm2-status', 'PM2 STATUS');
}

async function handleDocker(ctx) {
    await runTool(ctx, 'docker-ps', 'DOCKER CONTAINERS');
}

async function handleDockerImages(ctx) {
    await runTool(ctx, 'docker-images', 'DOCKER IMAGES');
}

async function handleDockerStats(ctx) {
    await runTool(ctx, 'docker-stats', 'DOCKER STATS');
}

async function handleDf(ctx) {
    await runTool(ctx, 'df', 'DISK USAGE');
}

async function handleFree(ctx) {
    await runTool(ctx, 'free', 'MEMORY USAGE');
}

async function handleUptime(ctx) {
    await runTool(ctx, 'uptime', 'UPTIME');
}

async function handleWho(ctx) {
    await runTool(ctx, 'who', 'USERS ONLINE');
}

async function handleTop(ctx) {
    await runTool(ctx, 'top', 'TOP PROSES');
}

async function handleSs(ctx) {
    await runTool(ctx, 'ss', 'OPEN PORTS');
}

async function handleIp(ctx) {
    await runTool(ctx, 'ip', 'IP ADDRESS');
}

async function handleToolsList(ctx) {
    const { sock, jid } = ctx;

    const tools = [
        '/pm2 -- PM2 process list',
        '/docker -- Docker containers aktif',
        '/docker images -- Docker images',
        '/docker stats -- Docker resource usage',
        '/df -- Disk usage',
        '/free -- Memory usage',
        '/uptime -- Server uptime & load',
        '/who -- User yang login',
        '/top -- Top proses (by CPU)',
        '/ports -- Port yang terbuka',
        '/ip -- IP address server',
    ];

    await sock.sendMessage(jid, {
        text: '*DAFTAR TOOLS*\n\n' + tools.join('\n'),
    });
}

module.exports = {
    handlePm2, handleDocker, handleDockerImages, handleDockerStats,
    handleDf, handleFree, handleUptime, handleWho, handleTop,
    handleSs, handleIp, handleToolsList,
};
