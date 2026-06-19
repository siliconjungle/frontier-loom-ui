import { startLoomUiServer } from '../dist/index.js';

const cwd = process.argv[2] ?? process.cwd();
const port = Number(process.argv[3] ?? 5175);

const server = await startLoomUiServer({
  cwd,
  host: '127.0.0.1',
  port
});

console.log(`frontier-loom-ui listening at ${server.url}`);

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

setInterval(() => {}, 1000);
