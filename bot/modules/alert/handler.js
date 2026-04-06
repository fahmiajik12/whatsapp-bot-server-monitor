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

module.exports = { handleAlertOn, handleAlertOff, handleAlertStatus };
