const { getAPIClient } = require('../../core/api-client');
const { formatStatusText } = require('./handler'); 

class LiveStatusManager {
    constructor() {
        this.activeSessions = new Map();
        this.maxUpdates = 24; 
        this.intervalDelay = 5000;
    }

    async start(sock, jid, serverName) {
        if (this.activeSessions.has(jid)) {
            this.stop(jid);
        }

        const api = getAPIClient();
        
        try {
            await sock.sendPresenceUpdate('composing', jid);
            const { data } = await api.get(serverName, '/api/monitoring/status');
            if (!data.success) {
                await sock.sendMessage(jid, { text: `❌ Gagal memulai live status: ${data.error}` });
                return;
            }

            const initialText = this._getFormattedText(data.data, serverName, this.maxUpdates);
            const sentMsg = await sock.sendMessage(jid, { text: initialText });

            const session = {
                sock,
                jid,
                serverName,
                msgKey: sentMsg.key,
                updatesLeft: this.maxUpdates,
                timer: setInterval(() => this._tick(jid), this.intervalDelay)
            };

            this.activeSessions.set(jid, session);
        } catch (err) {
            await sock.sendMessage(jid, { text: `❌ Error live status: ${err.message}` });
        }
    }

    stop(jid) {
        const session = this.activeSessions.get(jid);
        if (session) {
            clearInterval(session.timer);
            this.activeSessions.delete(jid);
            return true;
        }
        return false;
    }

    async _tick(jid) {
        const session = this.activeSessions.get(jid);
        if (!session) return;

        session.updatesLeft--;
        const { sock, serverName, msgKey, updatesLeft } = session;

        if (updatesLeft <= 0) {
            this.stop(jid);
            try {
                const api = getAPIClient();
                const { data } = await api.get(serverName, '/api/monitoring/status');
                if (data.success) {
                    const text = this._getFormattedText(data.data, serverName, 0) + "\n\n🛑 *Live Status Berakhir*";
                    await sock.sendMessage(jid, { edit: msgKey, text });
                }
            } catch (e) {}
            return;
        }

        try {
            const api = getAPIClient();
            const { data } = await api.get(serverName, '/api/monitoring/status');
            if (data.success) {
                const text = this._getFormattedText(data.data, serverName, updatesLeft);
                await sock.sendMessage(jid, { edit: msgKey, text });
            }
        } catch (e) {
        }
    }

    _getFormattedText(s, serverName, updatesLeft) {
        const { formatStatusText } = require('./handler');
        let text = formatStatusText(s, serverName);
        if (updatesLeft > 0) {
            text += `\n\n🔄 _Auto-update dalam 5s... (${updatesLeft}x tersisa)_`;
        }
        return text;
    }
}

let instance = null;

function getLiveStatusManager() {
    if (!instance) {
        instance = new LiveStatusManager();
    }
    return instance;
}

module.exports = { getLiveStatusManager, LiveStatusManager };
