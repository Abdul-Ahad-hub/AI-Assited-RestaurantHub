import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom'
});

try {
  await vite.ssrLoadModule('/scripts/verify-workflows.ts');
} finally {
  await vite.close();
}
