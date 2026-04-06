const fs = require('fs');
const path = require('path');
const config = require('../config.json');

function loadModules() {
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

    console.log(`[INFO] Total ${modules.length} modul dimuat`);
    return modules;
}

module.exports = { loadModules };
