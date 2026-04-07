const { loadModules } = require('./module-loader');
const { findSimilarCommands, formatSuggestions } = require('./nlp-parser');
const { getAuditLogger } = require('./audit-logger');
const { getSessionManager } = require('./session-manager');

const commands = new Map();
let modulesLoaded = false;

function registerCommand(commandDef) {
    const { name, aliases = [], handler, permission = 'user' } = commandDef;
    const entry = { ...commandDef, handler, permission };
    commands.set(name.toLowerCase(), entry);
    for (const alias of aliases) {
        commands.set(alias.toLowerCase(), entry);
    }
}

async function dispatcher(ctx) {
    if (!modulesLoaded) {
        const modules = loadModules();
        for (const mod of modules) {
            if (mod.commands) {
                for (const cmd of mod.commands) {
                    registerCommand(cmd);
                }
            }
        }
        modulesLoaded = true;
        console.log(`[INFO] ${commands.size} commands terdaftar`);
    }

    const { command, sock, jid, senderRole, senderNumber } = ctx;
    const startTime = Date.now();

    const sessions = getSessionManager();
    ctx.session = sessions.get(senderNumber);
    ctx.selectedServer = sessions.getServer(senderNumber) || null;

    let entry = commands.get(command);

    if (!entry && ctx.args.length > 0) {
        const subCommand = `${command} ${ctx.args[0]}`.toLowerCase();
        entry = commands.get(subCommand);
        if (entry) {
            ctx.args = ctx.args.slice(1);
        }
    }

    if (!entry) {
        if (command === 'help') {
            await sendHelp(ctx);
            return;
        }

        const suggestions = findSimilarCommands(command, commands);
        const suggestionText = formatSuggestions(command, suggestions);
        await sock.sendMessage(jid, { text: suggestionText });
        logAudit(ctx, 'not_found', startTime);
        return;
    }

    if (!hasPermission(senderRole, entry.permission)) {
        await sock.sendMessage(jid, {
            text: `❌ *Akses Ditolak*\n\nCommand ini memerlukan role: *${entry.permission}*\nRole Anda: *${senderRole}*`,
        });
        logAudit(ctx, 'denied', startTime);
        return;
    }

    try {
        await entry.handler(ctx);
        logAudit(ctx, 'success', startTime);
    } catch (err) {
        console.error(`[ERR] Error di handler /${command}:`, err);
        await sock.sendMessage(jid, {
            text: `❌ *Error*\n\nTerjadi kesalahan saat memproses command:\n${err.message}`,
        });
        logAudit(ctx, 'error', startTime, err.message);
    }
}

function hasPermission(userRole, requiredRole) {
    const hierarchy = { superadmin: 3, admin: 2, user: 1 };
    return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
}

function logAudit(ctx, result, startTime, error = null) {
    try {
        const audit = getAuditLogger();
        audit.log({
            user: ctx.senderNumber,
            role: ctx.senderRole,
            command: `/${ctx.command} ${(ctx.args || []).join(' ')}`.trim(),
            server: ctx.selectedServer || 'local',
            result,
            duration_ms: Date.now() - startTime,
            error,
        });
    } catch (err) {
        console.error('[AUDIT] Error:', err.message);
    }
}

async function sendHelp(ctx) {
    const { sock, jid, senderRole } = ctx;

    let helpText = '📖 *DAFTAR COMMAND*\n';
    helpText += '━━━━━━━━━━━━━━━━━━\n\n';

    const moduleCommands = new Map();

    for (const [name, entry] of commands) {
        if (name !== entry.name) continue;
        if (!hasPermission(senderRole, entry.permission)) continue;

        const moduleName = entry.module || 'other';
        if (!moduleCommands.has(moduleName)) {
            moduleCommands.set(moduleName, []);
        }
        moduleCommands.get(moduleName).push(entry);
    }

    const labels = {
        monitoring: '📊 MONITORING',
        service: '⚙️ SERVICE',
        apache: '🌐 APACHE',
        process: '🔄 PROCESS',
        logs: '📋 LOGS',
        auth: '🔐 AUTH',
        alert: '🔔 ALERT',
        tools: '🔧 TOOLS',
        menu: '📱 MENU',
        automation: '🤖 AUTOMATION',
        settings: '⚙️ SETTINGS',
    };

    for (const [moduleName, cmds] of moduleCommands) {
        helpText += `*${labels[moduleName] || '📦 ' + moduleName.toUpperCase()}*\n`;
        for (const cmd of cmds) {
            helpText += `  /${cmd.usage || cmd.name}`;
            if (cmd.description) helpText += ` — ${cmd.description}`;
            helpText += '\n';
        }
        helpText += '\n';
    }

    helpText += '━━━━━━━━━━━━━━━━━━\n';
    helpText += '💡 Ketik */menu* untuk menu interaktif\n';
    helpText += '💬 Atau ketik perintah langsung, misal: "restart apache"';

    await sock.sendMessage(jid, { text: helpText });
}

function getCommands() {
    return commands;
}

module.exports = { dispatcher, registerCommand, getCommands };
