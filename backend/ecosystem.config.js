module.exports = {
    apps: [
        {
            name: 'shino-blog-backend',
            script: 'src/index.ts',
            interpreter: 'bun',
            cwd: '/opt/shino-blog/backend',
            env_file: '/opt/shino-blog/env/backend.env',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            watch: false,
            max_memory_restart: '512M',
            log_file: '/opt/shino-blog/logs/combined.log',
            out_file: '/opt/shino-blog/logs/out.log',
            error_file: '/opt/shino-blog/logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            kill_timeout: 5000,
            listen_timeout: 8000,
            // Graceful shutdown: wait for existing connections
            wait_ready: true,
        },
    ],
};
