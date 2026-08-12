import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    // Node 22 下默认 forks 池会让 worker 启动即崩溃（vitest #9762），threads 池无此问题
    pool: 'threads'
  }
});
