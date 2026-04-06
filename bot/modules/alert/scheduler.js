const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

    isRunning() {
        return this.running;
    }

    getInterval() {
        const config = loadConfig();
        return config.alert?.intervalSeconds || 60;
    }

    getCooldown() {
        const config = loadConfig();
        return config.alert?.cooldownSeconds || 300;
    }

    getStats() {
        return { ...this.stats };
    }

    async check() {
        const config = loadConfig();

        if (!config.alertGroupId) return;

        const { getConnectionStatus } = require('../../core/client');
        if (!getConnectionStatus()) {
            console.log('[WARN] Alert skip: koneksi belum siap');
            return;
        }

        this.stats.totalChecks++;

        const api = axios.create({
            baseURL: config.backendUrl,
            headers: { 'X-API-Key': config.apiKey },
            timeout: 10000,
        });

        try {
            const { data } = await api.get('/api/monitoring/status');
            if (!data.success) return;

            const status = data.data;
            const thresholds = config.alert?.thresholds || { cpu: 80, disk: 90 };
            const alerts = [];

            if (status.cpu > thresholds.cpu) {
                alerts.push({
                    type: 'cpu',
                    message:
                        `[!] *CPU Usage Tinggi!*\n` +
                        `- Usage: ${status.cpu.toFixed(1)}%\n` +
                        `- Threshold: ${thresholds.cpu}%\n` +
                        `- Waktu: ${new Date().toLocaleString('id-ID')}`,
                });
            }

            if (status.disk.usedPercent > thresholds.disk) {
                alerts.push({
                    type: 'disk',
                    message:
                        `[!] *Disk Usage Tinggi!*\n` +
                        `- Usage: ${status.disk.usedPercent.toFixed(1)}%\n` +
                        `- Threshold: ${thresholds.disk}%\n` +
                        `- Waktu: ${new Date().toLocaleString('id-ID')}`,
                });
            }

            try {
                const apacheRes = await api.get('/api/apache/status');
                if (apacheRes.data.success) {
                    const apacheStatus = apacheRes.data.data;
                    if (!apacheStatus.active?.includes('running')) {
                        alerts.push({
                            type: 'apache',
                            message:
                                `[!] *Apache DOWN!*\n` +
                                `- Status: ${apacheStatus.active}\n` +
                                `- Waktu: ${new Date().toLocaleString('id-ID')}`,
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
            const text = `*ALERT SERVER*\n\n` + alert.message + `\n\nServer: wabot-server`;
            await this.sock.sendMessage(groupId, { text });

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
