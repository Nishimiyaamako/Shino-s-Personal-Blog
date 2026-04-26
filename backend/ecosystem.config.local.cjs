module.exports = {
    apps: [
        {
            name: 'shino-blog-backend-local',
            script: './dist/index.js',
            interpreter: '/usr/bin/bun',
            cwd: '/home/shino/Codes/Personal Blog/backend',
            env_file: '/home/shino/Codes/Personal Blog/backend/.env',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            watch: false,
            max_memory_restart: '512M',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            kill_timeout: 5000,
            listen_timeout: 8000,
            wait_ready: true,
        },
    ],
};