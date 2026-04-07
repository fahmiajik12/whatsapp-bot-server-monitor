const fs = require('fs');
const path = require('path');
const { getAuditLogger } = require('../../core/audit-logger');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

async function handleSettings(ctx) {
    const { sock, jid } = ctx;

    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

        let text = '⚙️ *Konfigurasi Aktif*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        text += '🔔 *Alert*\n';
        text += `   Status: ${config.alert?.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n`;
        text += `   Interval: ${config.alert?.intervalSeconds || 60}s\n`;
        text += `   Cooldown: ${config.alert?.cooldownSeconds || 300}s\n`;
        text += `   CPU Threshold: ${config.alert?.thresholds?.cpu || 80}%\n`;
        text += `   RAM Threshold: ${config.alert?.thresholds?.ram || '-'}%\n`;
        text += `   Disk Threshold: ${config.alert?.thresholds?.disk || 90}%\n\n`;

        if (config.monitoring) {
            text += '📊 *Monitoring*\n';
            text += `   Baseline Window: ${config.monitoring.baselineWindow || 60} sampel\n`;
            text += `   Spike Multiplier: ${config.monitoring.spikeMultiplier || 1.5}x\n\n`;
        }

        if (config.security) {
            text += '🔐 *Security*\n';
            text += `   Rate Limit: ${config.security.rateLimitPerMinute || 30}/menit\n`;
            text += `   Audit: ${config.security.auditEnabled !== false ? '✅' : '❌'}\n`;
            text += `   Konfirmasi: ${(config.security.requireConfirmation || []).join(', ') || '-'}\n\n`;
        }

        text += '📦 *Modules*\n';
        if (config.modules) {
            for (const [name, enabled] of Object.entries(config.modules)) {
                text += `   ${enabled ? '✅' : '❌'} ${name}\n`;
            }
        }
        text += '\n';

        if (config.servers) {
            text += '🖥️ *Servers*\n';
            for (const [id, srv] of Object.entries(config.servers)) {
                const def = srv.default ? ' _(default)_' : '';
                text += `   ${srv.isLocal ? '📍' : '🌐'} ${id}: ${srv.name || id}${def}\n`;
            }
        }

        text += '\n━━━━━━━━━━━━━━━━━━\n';
        text += '💡 /settings set <key> <value>\n';
        text += 'Contoh: /settings set alert.thresholds.cpu 90';

        await sock.sendMessage(jid, { text });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal membaca config: ${err.message}`,
        });
    }
}

async function handleSettingsUpdate(ctx) {
    const { sock, jid, args, senderNumber } = ctx;

    if (args.length < 2) {
        await sock.sendMessage(jid, {
            text: '📝 *Penggunaan:* /settings set <key> <value>\n\n' +
                'Key yang didukung:\n' +
                '- alert.thresholds.cpu <angka>\n' +
                '- alert.thresholds.disk <angka>\n' +
                '- alert.thresholds.ram <angka>\n' +
                '- alert.intervalSeconds <angka>\n' +
                '- alert.cooldownSeconds <angka>\n' +
                '- alert.enabled <true/false>\n' +
                '- security.rateLimitPerMinute <angka>\n\n' +
                'Contoh: /settings set alert.thresholds.cpu 90',
        });
        return;
    }

    const key = args[0];
    const value = args.slice(1).join(' ');

    const allowedKeys = [
        'alert.thresholds.cpu',
        'alert.thresholds.disk',
        'alert.thresholds.ram',
        'alert.intervalSeconds',
        'alert.cooldownSeconds',
        'alert.enabled',
        'alert.smartAnalysis',
        'security.rateLimitPerMinute',
        'monitoring.spikeMultiplier',
        'monitoring.baselineWindow',
        'ui.sessionTimeoutMinutes',
    ];

    if (!allowedKeys.includes(key)) {
        await sock.sendMessage(jid, {
            text: `❌ Key "${key}" tidak diizinkan untuk diubah.\n\nKey yang didukung:\n${allowedKeys.map(k => `- ${k}`).join('\n')}`,
        });
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

        let parsedValue;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(value)) parsedValue = Number(value);
        else parsedValue = value;

        const keys = key.split('.');
        let obj = config;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        const oldValue = obj[keys[keys.length - 1]];
        obj[keys[keys.length - 1]] = parsedValue;

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        await sock.sendMessage(jid, {
            text: `✅ *Config diubah*\n\n` +
                `Key: ${key}\n` +
                `Sebelum: ${oldValue}\n` +
                `Sesudah: ${parsedValue}\n\n` +
                `⚠️ Beberapa perubahan memerlukan restart bot.`,
        });
    } catch (err) {
        await sock.sendMessage(jid, {
            text: `❌ Gagal update config: ${err.message}`,
        });
    }
}

async function handleAudit(ctx) {
    const { sock, jid, args } = ctx;

    const count = parseInt(args[0]) || 20;
    const audit = getAuditLogger();
    const entries = audit.readLocal(Math.min(count, 50));

    if (entries.length === 0) {
        await sock.sendMessage(jid, {
            text: '📝 *Audit Log*\n\nBelum ada catatan audit.',
        });
        return;
    }

    let text = '📝 *Audit Log*\n';
    text += '━━━━━━━━━━━━━━━━━━\n\n';

    for (const entry of entries) {
        const time = new Date(entry.timestamp).toLocaleString('id-ID');
        const icon = entry.result === 'success' ? '✅' :
            entry.result === 'denied' ? '🚫' :
                entry.result === 'error' ? '❌' : '❓';

        text += `${icon} ${time}\n`;
        text += `   ${entry.role || '?'}: ${entry.command}\n`;
        if (entry.error) {
            text += `   Error: ${entry.error}\n`;
        }
        text += '\n';
    }

    if (text.length > 3500) {
        text = text.substring(0, 3500) + '\n... (dipotong)';
    }

    await sock.sendMessage(jid, { text });
}

module.exports = { handleSettings, handleSettingsUpdate, handleAudit };
