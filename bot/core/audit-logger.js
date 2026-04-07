const fs = require('fs');
const path = require('path');

const LOCAL_LOG_PATH = path.join(__dirname, '..', 'logs', 'audit.jsonl');

class AuditLogger {
    constructor() {
        this.apiClient = null;
        this.queue = [];
        this.ensureLogDir();
    }

    setAPIClient(apiClient) {
        this.apiClient = apiClient;
    }

    ensureLogDir() {
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    async log(entry) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            user: entry.user || '',
            role: entry.role || '',
            command: entry.command || '',
            args: entry.args || [],
            server: entry.server || 'local',
            result: entry.result || 'unknown',
            duration_ms: entry.duration_ms || 0,
            error: entry.error || null,
        };

        this.writeLocal(logEntry);

        this.sendToBackend(logEntry).catch(err => {
            console.error('[AUDIT] Gagal kirim ke backend:', err.message);
        });
    }

    writeLocal(entry) {
        try {
            const line = JSON.stringify(entry) + '\n';
            fs.appendFileSync(LOCAL_LOG_PATH, line, 'utf-8');
        } catch (err) {
            console.error('[AUDIT] Gagal tulis lokal:', err.message);
        }
    }

    async sendToBackend(entry) {
        if (!this.apiClient) return;

        try {
            await this.apiClient.post(null, '/api/audit/log', entry);
        } catch (err) {
            if (this.queue.length < 100) {
                this.queue.push(entry);
            }
            throw err;
        }
    }

    async flushQueue() {
        if (!this.apiClient || this.queue.length === 0) return;

        const batch = [...this.queue];
        this.queue = [];

        for (const entry of batch) {
            try {
                await this.apiClient.post(null, '/api/audit/log', entry);
            } catch (err) {
                if (this.queue.length < 100) {
                    this.queue.push(entry);
                }
                break;
            }
        }
    }

    readLocal(count = 20) {
        try {
            if (!fs.existsSync(LOCAL_LOG_PATH)) return [];

            const content = fs.readFileSync(LOCAL_LOG_PATH, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l);
            const entries = [];

            const start = Math.max(0, lines.length - count);
            for (let i = start; i < lines.length; i++) {
                try {
                    entries.push(JSON.parse(lines[i]));
                } catch (e) {}
            }

            return entries;
        } catch (err) {
            console.error('[AUDIT] Gagal baca log lokal:', err.message);
            return [];
        }
    }
}

let instance = null;

function getAuditLogger() {
    if (!instance) {
        instance = new AuditLogger();
    }
    return instance;
}

module.exports = { getAuditLogger, AuditLogger };
