class SessionManager {
    constructor(options = {}) {
        this.sessions = new Map();
        this.timeoutMinutes = options.timeoutMinutes || 10;
        this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    }

    get(senderNumber) {
        let session = this.sessions.get(senderNumber);
        if (!session) {
            session = this.createSession(senderNumber);
        }
        session.lastActivity = Date.now();
        return session;
    }

    createSession(senderNumber) {
        const session = {
            senderNumber,
            menuPath: [],
            selectedServer: null,
            pendingAction: null,
            wizardState: null,
            lastActivity: Date.now(),
            data: {},
        };
        this.sessions.set(senderNumber, session);
        return session;
    }

    isInMenu(senderNumber) {
        const session = this.sessions.get(senderNumber);
        return session && session.menuPath.length > 0;
    }

    pushMenu(senderNumber, menuId) {
        const session = this.get(senderNumber);
        session.menuPath.push(menuId);
        return session;
    }

    popMenu(senderNumber) {
        const session = this.get(senderNumber);
        if (session.menuPath.length > 0) {
            session.menuPath.pop();
        }
        return session.menuPath[session.menuPath.length - 1] || null;
    }

    goHome(senderNumber) {
        const session = this.get(senderNumber);
        session.menuPath = [];
        session.pendingAction = null;
        session.wizardState = null;
        return session;
    }

    getCurrentMenu(senderNumber) {
        const session = this.sessions.get(senderNumber);
        if (!session || session.menuPath.length === 0) return null;
        return session.menuPath[session.menuPath.length - 1];
    }

    setPendingAction(senderNumber, action) {
        const session = this.get(senderNumber);
        session.pendingAction = {
            ...action,
            createdAt: Date.now(),
        };
        return session;
    }

    consumePendingAction(senderNumber) {
        const session = this.sessions.get(senderNumber);
        if (!session) return null;
        const action = session.pendingAction;
        session.pendingAction = null;
        return action;
    }

    hasPendingAction(senderNumber) {
        const session = this.sessions.get(senderNumber);
        return session && session.pendingAction !== null;
    }

    setServer(senderNumber, serverName) {
        const session = this.get(senderNumber);
        session.selectedServer = serverName;
        return session;
    }

    getServer(senderNumber) {
        const session = this.sessions.get(senderNumber);
        return session?.selectedServer || null;
    }

    clear(senderNumber) {
        this.sessions.delete(senderNumber);
    }

    cleanup() {
        const now = Date.now();
        const timeout = this.timeoutMinutes * 60 * 1000;
        for (const [number, session] of this.sessions) {
            if (now - session.lastActivity > timeout) {
                this.sessions.delete(number);
            }
        }
    }

    stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    get size() {
        return this.sessions.size;
    }
}

let instance = null;

function getSessionManager(options) {
    if (!instance) {
        instance = new SessionManager(options);
    }
    return instance;
}

module.exports = { getSessionManager, SessionManager };
