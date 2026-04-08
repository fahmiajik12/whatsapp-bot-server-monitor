const { getScheduler } = require('./scheduler');

async function handleAlertOn(ctx) {
    const { sock, jid } = ctx;
    const scheduler = getScheduler();

    if (scheduler.isRunning()) {
        await sock.sendMessage(jid, { text: '[i] Alert sudah aktif' });
        return;
    }

    scheduler.start(sock);
    await sock.sendMessage(jid, {
        text: '[+] *Alert monitoring diaktifkan*\n\n' +
            `- Interval: ${scheduler.getInterval()}s\n` +
            `- Cooldown: ${scheduler.getCooldown()}s`,
    });
}

async function handleAlertOff(ctx) {
    const { sock, jid } = ctx;
    const scheduler = getScheduler();

    if (!scheduler.isRunning()) {
        await sock.sendMessage(jid, { text: '[i] Alert sudah nonaktif' });
        return;
    }

    scheduler.stop();
    await sock.sendMessage(jid, {
        text: '[-] *Alert monitoring dinonaktifkan*',
    });
}

async function handleAlertStatus(ctx) {
    const { sock, jid } = ctx;
    const scheduler = getScheduler();

    const running = scheduler.isRunning();
    const stats = scheduler.getStats();

    await sock.sendMessage(jid, {
        text:
            `*ALERT STATUS*\n\n` +
            `- Status: ${running ? '[+] Aktif' : '[-] Nonaktif'}\n` +
            `- Interval: ${scheduler.getInterval()}s\n` +
            `- Cooldown: ${scheduler.getCooldown()}s\n` +
            `- Total cek: ${stats.totalChecks}\n` +
            `- Total alert: ${stats.totalAlerts}\n` +
            `- Alert terakhir: ${stats.lastAlert || '-'}`,
    });
}

async function handleDiagnose(ctx) {
    const { sock, jid, args } = ctx;
    const { getAPIClient } = require('../../core/api-client');
    const api = getAPIClient();
    
    const { target, server } = api.parseServerFromArgs(args);
    const serverName = server || ctx.selectedServer;
    const serviceName = target;

    if (!serviceName) {
        await sock.sendMessage(jid, { text: '📝 *Penggunaan:* /diagnose <nama_service>\n\nContoh: /diagnose apache2' });
        return;
    }

    try {
        await sock.sendPresenceUpdate('composing', jid);
        const { data: statusRes } = await api.get(serverName, `/api/service/${serviceName}`);
        
        let statusText = 'unknown';
        if (statusRes && statusRes.success && statusRes.data) {
            statusText = statusRes.data.active;
        }

        const scheduler = getScheduler();
        const alertMsg = await scheduler.buildServiceDownAlert(serviceName, { active: statusText }, api);
        
        await sock.sendMessage(jid, { text: alertMsg.message });
    } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Gagal melakukan diagnosa: ${err.message}` });
    }
}

module.exports = { handleAlertOn, handleAlertOff, handleAlertStatus, handleDiagnose };
