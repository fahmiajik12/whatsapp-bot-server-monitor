const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { router } = require('./router');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');

const logger = pino({
    level: 'silent',
});

let sock = null;
let isConnected = false;
let retryCount = 0;

async function startClient() {
    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, '..', 'auth_info')
    );

    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['Wabot Server Monitor', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
        getMessage: async () => {
            return { conversation: '' };
        },
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n[INFO] Scan QR code berikut dengan WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                retryCount++;
                const delay = Math.min(retryCount * 3000, 30000);
                console.log(`[INFO] Reconnecting dalam ${delay/1000}s... (percobaan ${retryCount})`);
                setTimeout(startClient, delay);
            } else {
                console.log('[WARN] Logged out. Hapus folder auth_info dan scan ulang.');
            }
        }

        if (connection === 'open') {
            isConnected = true;
            retryCount = 0;
            console.log('[OK] Terhubung ke WhatsApp!');

            setTimeout(async () => {
                if (isConnected) {
                    await setupAlertGroup();
                }
            }, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        if (!isConnected) return;

        for (const msg of messages) {
            if (msg.key.fromMe) continue;
            if (!msg.message) continue;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                '';

            if (!text) continue;

            try {
                await router(sock, msg, text.trim());
            } catch (err) {
                console.error('[ERR] Error processing message:', err.message);
            }
        }
    });

    return sock;
}

async function setupAlertGroup() {
    const configPath = path.join(__dirname, '..', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    if (currentConfig.alertGroupId) {
        console.log(`[INFO] Alert grup sudah ada: ${currentConfig.alertGroupId}`);
        return;
    }

    if (!currentConfig.alert?.enabled) {
        return;
    }

    try {
        console.log('[INFO] Membuat grup alert...');

        const participants = Object.keys(currentConfig.adminNumbers).map(
            (num) => `${num}@s.whatsapp.net`
        );

        const group = await sock.groupCreate(
            currentConfig.alertGroupName || 'Server Monitor',
            participants
        );

        currentConfig.alertGroupId = group.id;
        fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));

        console.log(`[OK] Grup alert dibuat: ${group.id}`);

        await new Promise(r => setTimeout(r, 3000));

        await sock.sendMessage(group.id, {
            text:
                '*Server Monitor Bot Aktif!*\n\n' +
                'Bot ini akan mengirim alert otomatis ke grup ini.\n\n' +
                'Threshold:\n' +
                `- CPU > ${currentConfig.alert.thresholds.cpu}%\n` +
                `- Disk > ${currentConfig.alert.thresholds.disk}%\n` +
                '- Apache down\n\n' +
                `Interval cek: ${currentConfig.alert.intervalSeconds} detik`,
        });
    } catch (err) {
        console.error('[ERR] Gagal membuat grup alert:', err.message);
    }
}

function getSocket() {
    return sock;
}

function getConnectionStatus() {
    return isConnected;
}

module.exports = { startClient, getSocket, getConnectionStatus };
