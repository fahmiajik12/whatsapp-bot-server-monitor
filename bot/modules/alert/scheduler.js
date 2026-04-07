const fs = require('fs');
const path = require('path');
const { getAPIClient } = require('../../core/api-client');

let configData = null;

function loadConfig() {
    const configPath = path.join(__dirname, '..', '..', 'config.json');
    configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return configData;
}

class AlertScheduler {
    constructor() {
        this.timer = null;
        this.running = false;
        this.stats = {
            totalChecks: 0,
            totalAlerts: 0,
            lastAlert: null,
        };
        this.cooldowns = new Map();
        this.sock = null;
    }

    start(sock) {
        if (this.running) return;

        this.sock = sock;
        this.running = true;
        const config = loadConfig();
        const interval = (config.alert?.intervalSeconds || 60) * 1000;

        console.log(`[INFO] Alert scheduler dimulai (interval: ${interval / 1000}s)`);

        this.timer = setInterval(() => this.check(), interval);
        setTimeout(() => this.check(), 15000);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.running = false;
        console.log('[INFO] Alert scheduler dihentikan');
    }

    isRunning() { return this.running; }

    getInterval() {
        const config = loadConfig();
        return config.alert?.intervalSeconds || 60;
    }

    getCooldown() {
        const config = loadConfig();
        return config.alert?.cooldownSeconds || 300;
    }

    getStats() { return { ...this.stats }; }

    async check() {
        const config = loadConfig();

        if (!config.alertGroupId) return;

        const { getConnectionStatus } = require('../../core/client');
        if (!getConnectionStatus()) {
            console.log('[WARN] Alert skip: koneksi belum siap');
            return;
        }

        this.stats.totalChecks++;

        try {
            const api = getAPIClient();
            const { data } = await api.get(null, '/api/monitoring/status');
            if (!data.success) return;

            const status = data.data;
            const thresholds = config.alert?.thresholds || { cpu: 80, disk: 90 };
            const smartAnalysis = config.alert?.smartAnalysis !== false;
            const alerts = [];

            let baseline = null;
            if (smartAnalysis) {
                try {
                    const baselineRes = await api.get(null, '/api/monitoring/baseline');
                    if (baselineRes.data.success) {
                        baseline = baselineRes.data.data;
                    }
                } catch (_) {}
            }

            if (status.cpu > thresholds.cpu) {
                const alert = this.buildSmartAlert('cpu', status.cpu, thresholds.cpu, baseline);
                alerts.push(alert);
            }

            if (thresholds.ram && status.ram.usedPercent > thresholds.ram) {
                const alert = this.buildSmartAlert('ram', status.ram.usedPercent, thresholds.ram, baseline);
                alerts.push(alert);
            }

            if (status.disk.usedPercent > thresholds.disk) {
                const alert = this.buildSmartAlert('disk', status.disk.usedPercent, thresholds.disk, baseline);
                alerts.push(alert);
            }

            try {
                const apacheRes = await api.get(null, '/api/apache/status');
                if (apacheRes.data.success) {
                    const apacheStatus = apacheRes.data.data;
                    if (!apacheStatus.active?.includes('running')) {
                        alerts.push({
                            type: 'apache',
                            message: this.buildApacheAlert(apacheStatus),
                        });
                    }
                }
            } catch (_) {}

            for (const alert of alerts) {
                if (this.isCoolingDown(alert.type, config)) continue;
                await this.sendAlert(config.alertGroupId, alert);
                this.setCooldown(alert.type);
            }
        } catch (err) {
            console.error('[ERR] Alert check error:', err.message);
        }
    }

    buildSmartAlert(type, currentValue, threshold, baseline) {
        const time = new Date().toLocaleString('id-ID');
        const typeLabels = {
            cpu: 'CPU',
            ram: 'RAM',
            disk: 'Disk',
        };
        const label = typeLabels[type] || type.toUpperCase();

        let message = `🚨 *ALERT: ${label} Tinggi*\n`;
        message += '━━━━━━━━━━━━━━━━━━\n\n';

        message += '📊 *Metrics*\n';
        message += `   Saat ini: ${currentValue.toFixed(1)}%\n`;
        message += `   Threshold: ${threshold}%\n`;

        if (baseline) {
            const baselineKey = type;
            const baselineData = baseline[baselineKey];
            if (baselineData && baselineData.average > 0) {
                const spikeFactor = (currentValue / baselineData.average).toFixed(1);
                message += `   Baseline (avg): ${baselineData.average.toFixed(1)}%\n`;
                message += `   Spike factor: ${spikeFactor}x\n`;
            }
        }

        message += '\n🔍 *Analisis*\n';
        message += this.getAnalysisText(type, currentValue, baseline);

        message += '\n💡 *Rekomendasi*\n';
        const suggestions = this.getSuggestions(type);
        suggestions.forEach((s, i) => {
            message += `   ${i + 1}. ${s}\n`;
        });

        message += `\n⏰ ${time}`;

        return { type, message };
    }

    getAnalysisText(type, current, baseline) {
        const baselineAvg = baseline?.[type]?.average;

        switch (type) {
            case 'cpu':
                if (baselineAvg && current > baselineAvg * 2) {
                    return '   CPU jauh di atas baseline normal.\n   Kemungkinan ada proses yang consume resource berlebih.\n';
                }
                return '   CPU melebihi threshold.\n   Periksa proses yang berjalan.\n';

            case 'ram':
                if (current > 95) {
                    return '   RAM hampir penuh! Server berisiko OOM.\n   Segera ambil tindakan.\n';
                }
                return '   Penggunaan RAM tinggi.\n   Periksa proses dengan memory usage tertinggi.\n';

            case 'disk':
                if (current > 95) {
                    return '   Disk hampir penuh! Risiko crash tinggi.\n   Segera bersihkan file yang tidak diperlukan.\n';
                }
                return '   Penggunaan disk melebihi threshold.\n   Periksa file log dan temporary yang bisa dihapus.\n';

            default:
                return '';
        }
    }

    getSuggestions(type) {
        switch (type) {
            case 'cpu':
                return [
                    'Cek top process → /top',
                    'Kill process → /kill <PID>',
                    'Restart service terkait → /restart <service>',
                ];
            case 'ram':
                return [
                    'Cek memory usage → /free',
                    'Cek top process → /top',
                    'Restart service yang bocor memori',
                ];
            case 'disk':
                return [
                    'Cek disk usage → /df',
                    'Cleanup log files',
                    'Hapus file temporary',
                ];
            default:
                return ['Hubungi admin'];
        }
    }

    buildApacheAlert(apacheStatus) {
        const time = new Date().toLocaleString('id-ID');
        let message = '🚨 *ALERT: Apache DOWN*\n';
        message += '━━━━━━━━━━━━━━━━━━\n\n';
        message += `📊 Status: ${apacheStatus.active}\n\n`;
        message += '💡 *Rekomendasi*\n';
        message += '   1. Restart Apache → /restart apache2\n';
        message += '   2. Cek error log → /weblogs\n';
        message += '   3. Cek config → (configtest)\n';
        message += `\n⏰ ${time}`;
        return message;
    }

    isCoolingDown(type, config) {
        const lastSent = this.cooldowns.get(type);
        if (!lastSent) return false;
        const cooldownMs = (config.alert?.cooldownSeconds || 300) * 1000;
        return Date.now() - lastSent < cooldownMs;
    }

    setCooldown(type) {
        this.cooldowns.set(type, Date.now());
    }

    async sendAlert(groupId, alert) {
        if (!this.sock) return;

        try {
            await this.sock.sendMessage(groupId, { text: alert.message });

            this.stats.totalAlerts++;
            this.stats.lastAlert = new Date().toLocaleString('id-ID');
            console.log(`[ALERT] Alert terkirim ke grup: ${alert.type}`);
        } catch (err) {
            console.error(`[ERR] Gagal kirim alert: ${err.message}`);
        }
    }
}

let instance = null;

function getScheduler() {
    if (!instance) {
        instance = new AlertScheduler();
    }
    return instance;
}

module.exports = { getScheduler, AlertScheduler };
