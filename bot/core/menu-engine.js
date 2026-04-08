const { getSessionManager } = require('./session-manager');

const MENUS = {
    main: {
        title: '🖥️ DevOps Assistant',
        description: 'Pilih menu:',
        items: [
            { key: '1', emoji: '📊', label: 'Monitoring', action: 'menu:monitoring' },
            { key: '2', emoji: '⚙️', label: 'Service Manager', action: 'menu:service' },
            { key: '3', emoji: '📋', label: 'Logs', action: 'menu:logs' },
            { key: '4', emoji: '🔧', label: 'Tools', action: 'menu:tools' },
            { key: '5', emoji: '🤖', label: 'Automation', action: 'menu:automation' },
            { key: '6', emoji: '⚡', label: 'Quick Actions', action: 'menu:quickactions' },
            { key: '7', emoji: '⚙️', label: 'Settings', action: 'menu:settings' },
        ],
    },

    monitoring: {
        title: '📊 Monitoring',
        description: 'Pilih monitoring:',
        parent: 'main',
        items: [
            { key: '1', emoji: '🖥️', label: 'Status Server', action: 'cmd:status' },
            { key: '2', emoji: '📡', label: 'Status Services', action: 'cmd:services' },
            { key: '3', emoji: '⚠️', label: 'Laporan Anomali', action: 'cmd:anomaly' },
            { key: '4', emoji: '📈', label: 'Tren Resource', action: 'cmd:trends' },
            { key: '5', emoji: '📊', label: 'Baseline Data', action: 'cmd:baseline' },
            { key: '6', emoji: '🌐', label: 'Network Traffic', action: 'cmd:network' },
            { key: '7', emoji: '⏱️', label: 'Live Status', action: 'cmd:live' },
        ],
    },

    service: {
        title: '⚙️ Service Manager',
        description: 'Kelola service:',
        parent: 'main',
        items: [
            { key: '1', emoji: '📡', label: 'Lihat Semua Service', action: 'cmd:services' },
            { key: '2', emoji: '🔍', label: 'Cek Service', action: 'wizard:service_check' },
            { key: '3', emoji: '🔄', label: 'Restart Service', action: 'wizard:service_restart' },
            { key: '4', emoji: '▶️', label: 'Start Service', action: 'wizard:service_start' },
            { key: '5', emoji: '⏹️', label: 'Stop Service', action: 'wizard:service_stop' },
        ],
    },

    logs: {
        title: '📋 Logs',
        description: 'Lihat log:',
        parent: 'main',
        items: [
            { key: '1', emoji: '🌐', label: 'Apache Error Log', action: 'cmd:weblogs' },
            { key: '2', emoji: '📄', label: 'Log Service', action: 'wizard:logs_service' },
            { key: '3', emoji: '📝', label: 'Audit Log', action: 'cmd:audit' },
        ],
    },

    tools: {
        title: '🔧 Tools',
        description: 'Pilih tool:',
        parent: 'main',
        items: [
            { key: '1', emoji: '💻', label: 'PM2 Status', action: 'cmd:pm2' },
            { key: '2', emoji: '🐳', label: 'Docker', action: 'menu:docker' },
            { key: '3', emoji: '💾', label: 'Disk Usage (df)', action: 'cmd:df' },
            { key: '4', emoji: '🧠', label: 'Memory (free)', action: 'cmd:free' },
            { key: '5', emoji: '⏱️', label: 'Uptime', action: 'cmd:uptime' },
            { key: '6', emoji: '👥', label: 'Users Online', action: 'cmd:who' },
            { key: '7', emoji: '📊', label: 'Top Process', action: 'cmd:top' },
            { key: '8', emoji: '🌐', label: 'Open Ports', action: 'cmd:ports' },
            { key: '9', emoji: '🔗', label: 'IP Address', action: 'cmd:ip' },
        ],
    },

    docker: {
        title: '🐳 Docker',
        description: 'Pilih perintah Docker:',
        parent: 'tools',
        items: [
            { key: '1', emoji: '📦', label: 'Containers', action: 'cmd:docker' },
            { key: '2', emoji: '💿', label: 'Images', action: 'cmd:docker images' },
            { key: '3', emoji: '📊', label: 'Stats', action: 'cmd:docker stats' },
        ],
    },

    automation: {
        title: '🤖 Automation',
        description: 'Kelola aturan otomatis:',
        parent: 'main',
        items: [
            { key: '1', emoji: '📋', label: 'Lihat Rules', action: 'cmd:auto' },
            { key: '2', emoji: '✅', label: 'Enable Rule', action: 'wizard:auto_enable' },
            { key: '3', emoji: '❌', label: 'Disable Rule', action: 'wizard:auto_disable' },
            { key: '4', emoji: '📜', label: 'Riwayat Eksekusi', action: 'cmd:auto history' },
        ],
    },

    quickactions: {
        title: '⚡ Quick Actions',
        description: 'Aksi cepat:',
        parent: 'main',
        items: [
            { key: '1', emoji: '🔄', label: 'Restart Apache', action: 'confirm:restart_apache' },
            { key: '2', emoji: '🔄', label: 'Restart Nginx', action: 'confirm:restart_nginx' },
            { key: '3', emoji: '🧹', label: 'Clear Cache / Temp', action: 'confirm:clear_cache' },
            { key: '4', emoji: '🔪', label: 'Kill High CPU Process', action: 'cmd:top' },
            { key: '5', emoji: '📊', label: 'Full Status Report', action: 'cmd:status' },
            { key: '6', emoji: '🔔', label: 'Alert Status', action: 'cmd:alert status' },
        ],
    },

    settings: {
        title: '⚙️ Settings',
        description: 'Pengaturan:',
        parent: 'main',
        items: [
            { key: '1', emoji: '📊', label: 'Lihat Config', action: 'cmd:settings' },
            { key: '2', emoji: '🔔', label: 'Alert On/Off', action: 'menu:alert_settings' },
            { key: '3', emoji: '🖥️', label: 'Pilih Server', action: 'cmd:servers' },
            { key: '4', emoji: '👤', label: 'Daftar User', action: 'cmd:users' },
        ],
    },

    alert_settings: {
        title: '🔔 Alert Settings',
        description: 'Kelola alert:',
        parent: 'settings',
        items: [
            { key: '1', emoji: '✅', label: 'Aktifkan Alert', action: 'cmd:alert on' },
            { key: '2', emoji: '❌', label: 'Nonaktifkan Alert', action: 'cmd:alert off' },
            { key: '3', emoji: '📊', label: 'Status Alert', action: 'cmd:alert status' },
        ],
    },
};

const NUM_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

class MenuEngine {
    constructor() {
        this.menus = MENUS;
        this.confirmActions = {
            restart_apache: { description: 'Restart Apache', command: 'restart', args: ['apache2'] },
            restart_nginx: { description: 'Restart Nginx', command: 'restart', args: ['nginx'] },
            clear_cache: { description: 'Clear Cache / Temp Files', command: 'clearcache', args: [] },
        };
    }

    renderMenu(menuId) {
        const menu = this.menus[menuId];
        if (!menu) return null;

        let text = `${menu.title}\n`;
        text += '━━━━━━━━━━━━━━━━━━\n\n';

        for (const item of menu.items) {
            const num = parseInt(item.key);
            const emoji = num >= 0 && num <= 9 ? NUM_EMOJI[num] : `${item.key}.`;
            text += `${emoji} ${item.emoji} ${item.label}\n`;
        }

        if (menu.parent) {
            text += `\n${NUM_EMOJI[0]} ◀️ Kembali\n`;
        }

        text += '\n_Balas dengan angka atau ketik /help_';
        return text;
    }

    processInput(senderNumber, input) {
        const sessions = getSessionManager();
        const currentMenuId = sessions.getCurrentMenu(senderNumber);
        if (!currentMenuId) return null;

        const menu = this.menus[currentMenuId];
        if (!menu) return null;

        const trimmed = input.trim();

        if (trimmed === '0' || trimmed.toLowerCase() === 'back' || trimmed.toLowerCase() === 'kembali') {
            return this.goBack(senderNumber);
        }

        if (trimmed.toLowerCase() === 'home' || trimmed.toLowerCase() === 'menu') {
            sessions.goHome(senderNumber);
            sessions.pushMenu(senderNumber, 'main');
            return { type: 'menu', value: 'main' };
        }

        const item = menu.items.find(i => i.key === trimmed);
        if (!item) return null;

        return this.executeAction(senderNumber, item.action);
    }

    executeAction(senderNumber, action) {
        const sessions = getSessionManager();

        if (action.startsWith('menu:')) {
            const menuId = action.substring(5);
            sessions.pushMenu(senderNumber, menuId);
            return { type: 'menu', value: menuId };
        }

        if (action.startsWith('cmd:')) {
            const parts = action.substring(4).split(' ');
            return { type: 'command', value: { command: parts[0], args: parts.slice(1) } };
        }

        if (action.startsWith('confirm:')) {
            const actionId = action.substring(8);
            const confirmAction = this.confirmActions[actionId];
            if (!confirmAction) return null;

            sessions.setPendingAction(senderNumber, {
                type: 'command',
                command: confirmAction.command,
                args: confirmAction.args,
                description: confirmAction.description,
            });

            return { type: 'confirm', value: confirmAction };
        }

        if (action.startsWith('wizard:')) {
            const wizardId = action.substring(7);
            return { type: 'wizard', value: wizardId };
        }

        return null;
    }

    goBack(senderNumber) {
        const sessions = getSessionManager();
        const prevMenu = sessions.popMenu(senderNumber);

        if (prevMenu) {
            return { type: 'menu', value: prevMenu };
        }

        sessions.pushMenu(senderNumber, 'main');
        return { type: 'menu', value: 'main' };
    }

    openMenu(senderNumber, menuId = 'main') {
        const sessions = getSessionManager();
        sessions.goHome(senderNumber);
        sessions.pushMenu(senderNumber, menuId);
        return this.renderMenu(menuId);
    }

    renderConfirmation(description, serverName) {
        let text = '⚠️ *Konfirmasi*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';
        text += `${description}`;
        if (serverName) {
            text += ` di server *${serverName}*`;
        }
        text += '?\n\n';
        text += 'Balas: *ya* atau *tidak*';
        return text;
    }

    renderWizardPrompt(question, examples) {
        let text = '📝 *Input Diperlukan*\n';
        text += '━━━━━━━━━━━━━━━━━━\n\n';
        text += `${question}\n`;
        if (examples && examples.length > 0) {
            text += '\nContoh:\n';
            for (const ex of examples) {
                text += `- ${ex}\n`;
            }
        }
        text += '\n_Ketik "batal" untuk membatalkan_';
        return text;
    }

    isMenuInput(input) {
        const t = input.trim().toLowerCase();
        return /^[0-9]$/.test(t) || ['back', 'kembali', 'home', 'menu'].includes(t);
    }

    isConfirmation(input) {
        const t = input.trim().toLowerCase();
        return ['ya', 'yes', 'y', 'tidak', 'no', 'n', 'batal', 'cancel'].includes(t);
    }

    parseConfirmation(input) {
        const t = input.trim().toLowerCase();
        if (['ya', 'yes', 'y'].includes(t)) return true;
        if (['tidak', 'no', 'n', 'batal', 'cancel'].includes(t)) return false;
        return null;
    }
}

let instance = null;

function getMenuEngine() {
    if (!instance) {
        instance = new MenuEngine();
    }
    return instance;
}

module.exports = { getMenuEngine, MenuEngine, MENUS };
