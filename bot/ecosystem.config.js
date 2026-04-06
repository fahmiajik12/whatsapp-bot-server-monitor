const path = require('path');

module.exports = {
    apps: [
        {
            name: 'wabot',
            script: 'index.js',
            cwd: path.resolve(__dirname),
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production',
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: path.resolve(__dirname, 'logs', 'error.log'),
            out_file: path.resolve(__dirname, 'logs', 'out.log'),
            merge_logs: true,
        },
    ],
};
