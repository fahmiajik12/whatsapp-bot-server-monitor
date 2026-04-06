const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', '..', 'auth_store.json');
const config = require('../../config.json');

class AuthStore {
    constructor() {
        this.users = {};
        this.load();
    }

    load() {
        if (config.adminNumbers) {
            for (const [number, role] of Object.entries(config.adminNumbers)) {
                this.users[number] = role;
            }
        }

        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
                for (const [number, role] of Object.entries(data)) {
                    if (!this.users[number]) {
                        this.users[number] = role;
                    }
                }
            }
        } catch (err) {
            console.error('[WARN] Gagal load auth store:', err.message);
        }
    }

    save() {
        const extra = {};
        for (const [number, role] of Object.entries(this.users)) {
            if (!config.adminNumbers || !config.adminNumbers[number]) {
                extra[number] = role;
            }
        }
        fs.writeFileSync(STORE_PATH, JSON.stringify(extra, null, 2));
    }

    getRole(number) {
        return this.users[number] || null;
    }

    addUser(number, role = 'user') {
        this.users[number] = role;
        this.save();
    }

    removeUser(number) {
        if (config.adminNumbers && config.adminNumbers[number]) {
            return false;
        }
        delete this.users[number];
        this.save();
        return true;
    }

    listUsers() {
        return { ...this.users };
    }
}

let instance = null;

function getAuthStore() {
    if (!instance) {
        instance = new AuthStore();
    }
    return instance;
}

module.exports = { getAuthStore, AuthStore };
