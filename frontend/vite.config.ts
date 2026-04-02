import { defineConfig, loadEnv } from 'vite';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = stripTrailingSlash(env.VITE_DEV_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:3001');

  return {
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
