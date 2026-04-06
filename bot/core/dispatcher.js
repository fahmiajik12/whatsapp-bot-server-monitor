const { loadModules } = require('./module-loader');

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

    const { command, sock, jid, senderRole } = ctx;

    let entry = commands.get(command);

    if (!entry && ctx.args.length > 0) {
        const subCommand = `${command} ${ctx.args[0]}`.toLowerCase();
        entry = commands.get(subCommand);
        if (entry) {
            ctx.args = ctx.args.slice(1);
        }
    }

    if (!entry) {
        if (command === 'help' || command === 'menu') {
            await sendHelp(ctx);
            return;
        }

        await sock.sendMessage(jid, {
            text: `[?] Command */${command}* tidak ditemukan.\n\nKetik */help* untuk melihat daftar command.`,
        });
        return;
    }

    if (!hasPermission(senderRole, entry.permission)) {
        await sock.sendMessage(jid, {
            text: `[x] *Akses Ditolak*\n\nCommand ini memerlukan role: *${entry.permission}*\nRole Anda: *${senderRole}*`,
        });
        return;
    }

    try {
        await entry.handler(ctx);
    } catch (err) {
        console.error(`[ERR] Error di handler /${command}:`, err);
        await sock.sendMessage(jid, {
            text: `[!] *Error*\n\nTerjadi kesalahan saat memproses command:\n${err.message}`,
        });
    }
}

function hasPermission(userRole, requiredRole) {
    const hierarchy = { superadmin: 3, admin: 2, user: 1 };
    return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
}

async function sendHelp(ctx) {
    const { sock, jid, senderRole } = ctx;

    let helpText = '*DAFTAR COMMAND*\n\n';

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
        monitoring: '[MONITOR]',
        service: '[SERVICE]',
        apache: '[APACHE]',
        process: '[PROCESS]',
        logs: '[LOGS]',
        auth: '[AUTH]',
        alert: '[ALERT]',
    };

    for (const [moduleName, cmds] of moduleCommands) {
        helpText += `${labels[moduleName] || '[MODULE]'} *${moduleName.toUpperCase()}*\n`;
        for (const cmd of cmds) {
            helpText += `- /${cmd.usage || cmd.name}`;
            if (cmd.description) helpText += ` -- ${cmd.description}`;
            helpText += '\n';
        }
        helpText += '\n';
    }

    helpText += '_Ketik command untuk menjalankan_';

    await sock.sendMessage(jid, { text: helpText });
}

module.exports = { dispatcher, registerCommand };
