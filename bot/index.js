const { startClient } = require('./core/client');
const { getScheduler } = require('./modules/alert/scheduler');
const config = require('./config.json');

console.log('========================================');
console.log('  WABOT - Server Monitor Bot');
console.log('  WhatsApp Bot untuk Monitoring Server');
console.log('========================================');
console.log('');

async function main() {
    try {
        const sock = await startClient();

        if (config.alert?.enabled) {
            setTimeout(() => {
                const scheduler = getScheduler();
                scheduler.start(sock);
                console.log('[INFO] Alert scheduler aktif');
            }, 15000);
        }

        process.on('SIGINT', () => {
            console.log('\n[STOP] Shutting down...');
            const scheduler = getScheduler();
            scheduler.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n[STOP] Shutting down...');
            const scheduler = getScheduler();
            scheduler.stop();
            process.exit(0);
        });
    } catch (err) {
        console.error('[ERR] Fatal error:', err);
        process.exit(1);
    }
}

main();
