const config = require('../config.json');
const { dispatcher } = require('./dispatcher');
const { getAuthStore } = require('../modules/auth/store');
const { getSessionManager } = require('./session-manager');
const { getMenuEngine } = require('./menu-engine');
const { parseNaturalLanguage } = require('./nlp-parser');
const { getAuditLogger } = require('./audit-logger');

const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = config.security?.rateLimitPerMinute || 30;

async function router(sock, msg, text) {
    const prefix = config.prefix || '/';
    const jid = msg.key.remoteJid;
    const isGroup = jid?.endsWith('@g.us');
    const senderJid = isGroup ? msg.key.participant : jid;

    if (jid !== config.alertGroupId) {
        return;
    }

    let senderNumber = '';
    if (senderJid?.endsWith('@lid')) {
        const lidNumber = senderJid.replace('@lid', '');
        senderNumber = resolveLID(lidNumber, sock) || lidNumber;
    } else {
        senderNumber = senderJid?.replace('@s.whatsapp.net', '') || '';
    }

    const authStore = getAuthStore();
    let userRole = resolveUserRole(authStore, senderNumber, senderJid, sock);

    if (!userRole) {
        console.log(`[WARN] Nomor tidak terdaftar: ${senderNumber} (JID: ${senderJid})`);
        await sock.sendMessage(jid, {
            text: `❌ *Akses Ditolak*\n\nNomor ${senderNumber} tidak terdaftar.\nHubungi admin untuk mendapatkan akses.`,
        });
        return;
    }

    if (!checkRateLimit(senderNumber)) {
        await sock.sendMessage(jid, {
            text: '⏳ *Terlalu banyak request*\n\nCoba lagi dalam beberapa detik.',
        });
        return;
    }

    const senderName = msg.pushName || senderNumber;

    const baseCtx = {
        sock,
        msg,
        jid,
        senderNumber,
        senderName,
        senderRole: userRole,
        isGroup,
        text: text,
    };

    if (text.startsWith(prefix)) {
        const withoutPrefix = text.slice(prefix.length).trim();
        const parts = withoutPrefix.split(/\s+/);
        const command = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        if (!command) return;

        console.log(`[CMD] [${formatRole(userRole)}] ${senderName}: ${prefix}${command} ${args.join(' ')}`);

        if (command === 'menu' || command === 'home') {
            const menuEngine = getMenuEngine();
            const menuText = menuEngine.openMenu(senderNumber, 'main');
            await sock.sendMessage(jid, { text: menuText });
            return;
        }

        const ctx = { ...baseCtx, command, args };
        await dispatcher(ctx);
        return;
    }

    const sessions = getSessionManager();
    if (sessions.hasPendingAction(senderNumber)) {
        const menuEngine = getMenuEngine();

        if (menuEngine.isConfirmation(text)) {
            const confirmed = menuEngine.parseConfirmation(text);
            const action = sessions.consumePendingAction(senderNumber);

            if (confirmed && action) {
                console.log(`[CONFIRM] ${senderName}: ${action.description} → YA`);

                if (action.type === 'command') {
                    const ctx = { ...baseCtx, command: action.command, args: action.args || [] };
                    await dispatcher(ctx);
                }
            } else {
                await sock.sendMessage(jid, { text: '❎ Aksi dibatalkan.' });
            }
            return;
        }
    }

    const menuEngine = getMenuEngine();
    if (sessions.isInMenu(senderNumber) && menuEngine.isMenuInput(text)) {
        const result = menuEngine.processInput(senderNumber, text);

        if (result) {
            switch (result.type) {
                case 'menu': {
                    const menuText = menuEngine.renderMenu(result.value);
                    if (menuText) {
                        await sock.sendMessage(jid, { text: menuText });
                    }
                    break;
                }

                case 'command': {
                    const ctx = { ...baseCtx, command: result.value.command, args: result.value.args || [] };
                    console.log(`[MENU] ${senderName}: ${result.value.command}`);
                    await dispatcher(ctx);
                    break;
                }

                case 'confirm': {
                    const serverName = sessions.getServer(senderNumber);
                    const confirmText = menuEngine.renderConfirmation(result.value.description, serverName);
                    await sock.sendMessage(jid, { text: confirmText });
                    break;
                }

                case 'wizard': {
                    await handleWizard(baseCtx, result.value);
                    break;
                }
            }
            return;
        }
    }

    let nlpResult = parseNaturalLanguage(text);

    if (!nlpResult) {
        const { parseIntent } = require('./ai-engine');
        nlpResult = await parseIntent(text);
        if (nlpResult) {
            console.log(`[AI-NLP] ${senderName}: "${text}" → /${nlpResult.command} ${(nlpResult.args || []).join(' ')}`);
        }
    }

    if (nlpResult) {
        if (!nlpResult.args) nlpResult.args = [];

        if (!text.includes('[AI-NLP]')) {
            console.log(`[NLP] ${senderName}: "${text}" → /${nlpResult.command} ${nlpResult.args.join(' ')}`);
        }

        const dangerousCommands = config.security?.requireConfirmation || ['restart', 'stop', 'kill'];

        if (dangerousCommands.includes(nlpResult.command)) {
            sessions.setPendingAction(senderNumber, {
                type: 'command',
                command: nlpResult.command,
                args: nlpResult.args,
                description: `${nlpResult.command} ${nlpResult.args.join(' ')}`,
            });

            const confirmText = menuEngine.renderConfirmation(
                `${nlpResult.command.toUpperCase()} ${nlpResult.args.join(' ')}`,
                sessions.getServer(senderNumber)
            );
            await sock.sendMessage(jid, { text: confirmText });
            return;
        }

        const ctx = { ...baseCtx, command: nlpResult.command, args: nlpResult.args };
        await dispatcher(ctx);
        return;
    }

    try {
        const { chatWithAI } = require('./ai-engine');
        console.log(`[AI-CHAT] ${senderName}: "${text}"`);
        await sock.sendPresenceUpdate('composing', jid);
        
        const history = sessions.getAiHistory(senderNumber);
        const aiResponse = await chatWithAI(text, history);
        
        sessions.addAiHistory(senderNumber, 'user', text);
        sessions.addAiHistory(senderNumber, 'assistant', aiResponse);
        
        await sock.sendMessage(jid, { text: aiResponse });
    } catch (err) {
        console.error('[AI-CHAT] Error:', err.message);
    }
}

async function handleWizard(ctx, wizardId) {
    const { sock, jid, senderNumber } = ctx;
    const sessions = getSessionManager();
    const menuEngine = getMenuEngine();

    const wizards = {
        service_check: { question: 'Ketik nama service yang ingin dicek:', examples: ['apache2', 'nginx', 'mysql'], command: 'service' },
        service_restart: { question: 'Ketik nama service yang ingin di-restart:', examples: ['apache2', 'nginx', 'mysql'], command: 'restart', confirm: true },
        service_start: { question: 'Ketik nama service yang ingin di-start:', examples: ['apache2', 'nginx'], command: 'start', confirm: true },
        service_stop: { question: 'Ketik nama service yang ingin di-stop:', examples: ['apache2', 'nginx'], command: 'stop', confirm: true },
        logs_service: { question: 'Ketik nama service yang ingin dilihat lognya:', examples: ['apache2', 'nginx', 'mysql'], command: 'logs' },
        auto_enable: { question: 'Ketik ID rule yang ingin diaktifkan:', examples: ['apache-auto-restart', 'disk-cleanup'], command: 'auto enable' },
        auto_disable: { question: 'Ketik ID rule yang ingin dinonaktifkan:', examples: ['apache-auto-restart', 'disk-cleanup'], command: 'auto disable' },
    };

    const wizard = wizards[wizardId];
    if (!wizard) return;

    sessions.setPendingAction(senderNumber, {
        type: 'wizard_input',
        wizardId,
        command: wizard.command,
        confirm: wizard.confirm || false,
    });

    const promptText = menuEngine.renderWizardPrompt(wizard.question, wizard.examples);
    await sock.sendMessage(jid, { text: promptText });
}

function resolveUserRole(authStore, senderNumber, senderJid, sock) {
    let userRole = authStore.getRole(senderNumber);

    if (!userRole && senderJid?.endsWith('@lid')) {
        const lidNumber = senderJid.replace('@lid', '');
        const allUsers = authStore.listUsers();
        for (const [num, role] of Object.entries(allUsers)) {
            if (num === lidNumber) {
                userRole = role;
                break;
            }
        }

        if (!userRole) {
            const lidMap = getLIDMapping(sock);
            for (const [lid, phone] of Object.entries(lidMap)) {
                const r = authStore.getRole(phone);
                if (r && lid === lidNumber) {
                    userRole = r;
                    break;
                }
            }
        }
    }

    return userRole;
}

function resolveLID(lid, sock) {
    try {
        const store = sock?.authState?.creds;
        if (store?.me?.id) {
            const myNumber = store.me.id.replace(/@.*/, '').replace(/:\d+$/, '');
            if (store.me.lid && store.me.lid.includes(lid)) {
                return myNumber;
            }
        }
    } catch (e) { }
    return null;
}

function getLIDMapping(sock) {
    const mapping = {};
    try {
        const store = sock?.authState?.creds;
        if (store?.me) {
            const num = store.me.id.replace(/@.*/, '').replace(/:\d+$/, '');
            const lid = store.me.lid?.replace(/@.*/, '') || '';
            if (lid) mapping[lid] = num;
        }
    } catch (e) { }
    return mapping;
}

function formatRole(role) {
    const icons = { superadmin: '👑', admin: '⚡', user: '👤' };
    return `${icons[role] || '?'} ${role}`;
}

function checkRateLimit(senderNumber) {
    const now = Date.now();
    let entry = rateLimits.get(senderNumber);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        entry = { windowStart: now, count: 0 };
        rateLimits.set(senderNumber, entry);
    }

    entry.count++;
    return entry.count <= RATE_LIMIT_MAX;
}

module.exports = { router };
