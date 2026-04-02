import { ENV } from './config/env';
import { createApp } from './app';

const { app } = await createApp();

app.listen(ENV.port, () => {
  console.info(`[backend] listening on http://127.0.0.1:${ENV.port}`);
});
