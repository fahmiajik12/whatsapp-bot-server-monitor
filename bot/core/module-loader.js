const fs = require('fs');
const path = require('path');
const config = require('../config.json');

function loadModules() {
    const modules = [];

    const coreModules = loadCoreModules();
    modules.push(...coreModules);

    const plugins = loadPlugins();
    modules.push(...plugins);

    console.log(`[INFO] Total ${modules.length} modul dimuat (${coreModules.length} core + ${plugins.length} plugin)`);
    return modules;
}

function loadCoreModules() {
    const modulesDir = path.join(__dirname, '..', 'modules');
    const modules = [];

    if (!fs.existsSync(modulesDir)) {
        console.error('[ERR] Folder modules/ tidak ditemukan');
        return modules;
    }

    const folders = fs.readdirSync(modulesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    for (const folder of folders) {
        if (config.modules && config.modules[folder] === false) {
            console.log(`[SKIP] Modul '${folder}' dinonaktifkan`);
            continue;
        }

        const commandPath = path.join(modulesDir, folder, 'command.js');

        if (!fs.existsSync(commandPath)) {
            console.log(`[WARN] Modul '${folder}' tidak punya command.js, skip`);
            continue;
        }

        try {
            const mod = require(commandPath);
            modules.push(mod);
            console.log(`[OK] Modul '${folder}' dimuat (${mod.commands?.length || 0} commands)`);
        } catch (err) {
            console.error(`[ERR] Gagal load modul '${folder}':`, err.message);
        }
    }

    return modules;
}

function loadPlugins() {
    const modules = [];
    const pluginDirs = [
        path.join(__dirname, '..', 'plugins'),
        path.join(__dirname, '..', '..', 'plugins'),
        path.join(__dirname, '..', '..', 'plugins', 'private'),
    ];

    for (const pluginDir of pluginDirs) {
        if (!fs.existsSync(pluginDir)) continue;

        const folders = fs.readdirSync(pluginDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .filter((d) => d.name !== 'private' && d.name !== 'node_modules')
            .map((d) => d.name);

        for (const folder of folders) {
            if (config.plugins && config.plugins[folder] === false) {
                console.log(`[SKIP] Plugin '${folder}' dinonaktifkan`);
                continue;
            }

            const pluginPath = path.join(pluginDir, folder);
            const manifestPath = path.join(pluginPath, 'plugin.json');

            let manifest = null;
            if (fs.existsSync(manifestPath)) {
                try {
                    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                } catch (err) {
                    console.error(`[ERR] Plugin '${folder}': manifest rusak — ${err.message}`);
                    continue;
                }
            }

            const entrypoint = manifest?.bot?.entrypoint || 'bot/command.js';
            const commandPath = path.join(pluginPath, entrypoint);

            if (!fs.existsSync(commandPath)) {
                const altPath = path.join(pluginPath, 'command.js');
                if (fs.existsSync(altPath)) {
                    try {
                        const mod = require(altPath);
                        modules.push(mod);
                        console.log(`[OK] Plugin '${folder}' dimuat (${mod.commands?.length || 0} commands)`);
                    } catch (err) {
                        console.error(`[ERR] Gagal load plugin '${folder}':`, err.message);
                    }
                } else {
                    console.log(`[WARN] Plugin '${folder}' tidak punya entrypoint, skip`);
                }
                continue;
            }

            try {
                const mod = require(commandPath);
                modules.push(mod);
                const label = manifest?.name || folder;
                console.log(`[OK] Plugin '${label}' v${manifest?.version || '?'} dimuat (${mod.commands?.length || 0} commands)`);
            } catch (err) {
                console.error(`[ERR] Gagal load plugin '${folder}':`, err.message);
            }
        }
    }

    return modules;
}

module.exports = { loadModules };
