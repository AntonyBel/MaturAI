import { build } from 'esbuild';

async function run() {
  await build({
    entryPoints: ['backend/server.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    outfile: 'dist/server.cjs',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    }
  });
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
