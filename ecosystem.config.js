const path = require('path');
const { execSync } = require('child_process');

function getNodePath() {
    try {
        return execSync('which node').toString().trim();
    } catch (e) {
        return 'node';
    }
}

module.exports = {
    apps: [
        {
            name: 'wabot-backend',
            script: './wabot-backend',
            cwd: path.resolve(__dirname, 'backend'),
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '128M',
            env: {
                CONFIG_PATH: path.resolve(__dirname, 'backend/config.json'),
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: path.resolve(__dirname, 'logs/backend-error.log'),
            out_file: path.resolve(__dirname, 'logs/backend-out.log'),
            merge_logs: true,
        },
        {
            name: 'wabot-bot',
            script: 'index.js',
            cwd: path.resolve(__dirname, 'bot'),
            interpreter: getNodePath(),
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production',
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: path.resolve(__dirname, 'logs/bot-error.log'),
            out_file: path.resolve(__dirname, 'logs/bot-out.log'),
            merge_logs: true,
        },
    ],
};
