const { getAPIClient } = require('../../core/api-client');

async function handleAutoList(ctx) {
    const { sock, jid } = ctx;

    try {
        const api = getAPIClient();
        const { data } = await api.get(ctx.selectedServer, '/api/automation/rules');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const rules = data.data || [];

        if (rules.length === 0) {
            await sock.sendMessage(jid, { text: '🤖 *Automation Rules*\n\nBelum ada aturan automation yang dikonfigurasi.' });
            return;
        }

        let text = '🤖 *Automation Rules*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        for (const rule of rules) {
            const icon = rule.enabled ? '✅' : '❌';
            text += `${icon} *${rule.id}*\n`;
            text += `   ${rule.name}\n`;
            text += `   Kondisi: ${formatCondition(rule.condition)}\n`;
            text += `   Aksi: ${formatAction(rule.action)}\n`;
            text += `   Cooldown: ${formatDuration(rule.cooldownSeconds)}\n`;
            if (rule.runCount > 0) {
                text += `   Dijalankan: ${rule.runCount}x\n`;
            }
            text += '\n';
        }

        text += '━━━━━━━━━━━━━━━━━━\n';
        text += '💡 /auto enable <id> — Aktifkan\n';
        text += '💡 /auto disable <id> — Nonaktifkan';

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Gagal memuat automation rules: ${err.response?.data?.error || err.message}` });
    }
}

async function handleAutoEnable(ctx) {
    const { sock, jid, args } = ctx;
    const ruleId = args[0];

    if (!ruleId) {
        await sock.sendMessage(jid, { text: '📝 *Penggunaan:* /auto enable <id>\n\nContoh: /auto enable apache-auto-restart' });
        return;
    }

    try {
        const api = getAPIClient();
        const { data } = await api.put(ctx.selectedServer, `/api/automation/rules/${ruleId}`, { enabled: true });

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        await sock.sendMessage(jid, { text: `✅ Aturan *${ruleId}* telah diaktifkan.` });
    } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Gagal: ${err.response?.data?.error || err.message}` });
    }
}

async function handleAutoDisable(ctx) {
    const { sock, jid, args } = ctx;
    const ruleId = args[0];

    if (!ruleId) {
        await sock.sendMessage(jid, { text: '📝 *Penggunaan:* /auto disable <id>\n\nContoh: /auto disable apache-auto-restart' });
        return;
    }

    try {
        const api = getAPIClient();
        const { data } = await api.put(ctx.selectedServer, `/api/automation/rules/${ruleId}`, { enabled: false });

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        await sock.sendMessage(jid, { text: `❌ Aturan *${ruleId}* telah dinonaktifkan.` });
    } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Gagal: ${err.response?.data?.error || err.message}` });
    }
}

async function handleAutoHistory(ctx) {
    const { sock, jid } = ctx;

    try {
        const api = getAPIClient();
        const { data } = await api.get(ctx.selectedServer, '/api/automation/history');

        if (!data.success) {
            await sock.sendMessage(jid, { text: `❌ Error: ${data.error}` });
            return;
        }

        const history = data.data || [];

        if (history.length === 0) {
            await sock.sendMessage(jid, { text: '📜 *Riwayat Automation*\n\nBelum ada eksekusi otomatis.' });
            return;
        }

        let text = '📜 *Riwayat Automation*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        for (const entry of history.slice(-15)) {
            const icon = entry.success ? '✅' : '❌';
            const time = new Date(entry.timestamp).toLocaleString('id-ID');
            text += `${icon} ${time}\n`;
            text += `   Rule: ${entry.ruleId}\n`;
            text += `   Aksi: ${entry.action}\n`;
            if (entry.error) {
                text += `   Error: ${entry.error}\n`;
            }
            text += '\n';
        }

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, { text: `❌ Gagal: ${err.response?.data?.error || err.message}` });
    }
}

function formatCondition(condition) {
    if (!condition) return '-';
    switch (condition.type) {
        case 'service_down': return `${condition.target} down`;
        case 'cpu_above': return `CPU > ${condition.threshold}%`;
        case 'ram_above': return `RAM > ${condition.threshold}%`;
        case 'disk_above': return `Disk > ${condition.threshold}%`;
        default: return condition.type;
    }
}

function formatAction(action) {
    if (!action) return '-';
    switch (action.type) {
        case 'restart_service': return `Restart ${action.target}`;
        case 'cleanup_logs': return `Cleanup ${action.target}`;
        case 'send_alert': return 'Kirim alert';
        case 'run_command': return `Run: ${action.target}`;
        default: return action.type;
    }
}

function formatDuration(seconds) {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds} detik`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit`;
    return `${Math.floor(seconds / 3600)} jam`;
}

module.exports = { handleAutoList, handleAutoEnable, handleAutoDisable, handleAutoHistory };
