const { execSync } = require('child_process');
try {
  console.log("Running vite build...");
  execSync('npx vite build', { stdio: 'inherit' });
  if (process.env.CF_PAGES !== '1') {
    console.log("Running esbuild for server...");
    execSync('npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', { stdio: 'inherit' });
  }
} catch (e) {
  process.exit(1);
}
