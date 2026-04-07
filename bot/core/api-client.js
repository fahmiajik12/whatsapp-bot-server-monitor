const axios = require('axios');
const fs = require('fs');
const path = require('path');

class APIClient {
    constructor() {
        this.config = null;
        this.clients = new Map();
        this.reload();
    }

    reload() {
        const configPath = path.join(__dirname, '..', 'config.json');
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.clients.clear();
    }

    listServers() {
        if (this.config.servers) {
            return Object.entries(this.config.servers).map(([id, srv]) => ({
                id,
                name: srv.name || id,
                url: srv.url,
                isLocal: srv.isLocal || false,
                isDefault: srv.default || false,
            }));
        }

        return [{
            id: 'local',
            name: 'Local Server',
            url: this.config.backendUrl,
            isLocal: true,
            isDefault: true,
        }];
    }

    getDefaultServer() {
        if (this.config.servers) {
            for (const [id, srv] of Object.entries(this.config.servers)) {
                if (srv.default) return id;
            }
            const first = Object.keys(this.config.servers)[0];
            return first || 'local';
        }
        return 'local';
    }

    getClient(serverName) {
        const name = serverName || this.getDefaultServer();

        if (this.clients.has(name)) {
            return this.clients.get(name);
        }

        const serverConfig = this.resolveServer(name);
        const client = axios.create({
            baseURL: serverConfig.url,
            headers: { 'X-API-Key': serverConfig.apiKey },
            timeout: 15000,
        });

        this.clients.set(name, client);
        return client;
    }

    resolveServer(name) {
        if (this.config.servers && this.config.servers[name]) {
            const srv = this.config.servers[name];
            return {
                url: srv.url,
                apiKey: srv.apiKey || this.config.apiKey,
            };
        }

        return {
            url: this.config.backendUrl,
            apiKey: this.config.apiKey,
        };
    }

    async get(serverName, path, params = {}) {
        const client = this.getClient(serverName);
        return client.get(path, { params });
    }

    async post(serverName, path, data = {}) {
        const client = this.getClient(serverName);
        return client.post(path, data);
    }

    async put(serverName, path, data = {}) {
        const client = this.getClient(serverName);
        return client.put(path, data);
    }

    async delete(serverName, path) {
        const client = this.getClient(serverName);
        return client.delete(path);
    }

    isValidServer(name) {
        if (this.config.servers) {
            return name in this.config.servers;
        }
        return name === 'local';
    }

    parseServerFromArgs(args) {
        if (!args || args.length === 0) {
            return { target: null, server: null, remainingArgs: [] };
        }

        const lastArg = args[args.length - 1];

        if (this.isValidServer(lastArg)) {
            return {
                target: args.length > 1 ? args[0] : null,
                server: lastArg,
                remainingArgs: args.slice(0, -1),
            };
        }

        return {
            target: args[0],
            server: null,
            remainingArgs: [...args],
        };
    }
}

let instance = null;

function getAPIClient() {
    if (!instance) {
        instance = new APIClient();
    }
    return instance;
}

module.exports = { getAPIClient, APIClient };
