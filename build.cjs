const { execSync } = require('child_process');
try {
  console.log("Running vite build...");
  execSync('npx vite build', { stdio: 'inherit' });
} catch (e) {
  console.error("Vite build failed.");
  process.exit(1);
}

try {
  if (process.env.CF_PAGES !== '1') {
    console.log("Running esbuild for server...");
    execSync('npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', { stdio: 'inherit' });
  } else {
    console.log("Skipping esbuild on CF Pages.");
  }
} catch (e) {
  console.log("Esbuild failed (ignoring for CF Pages compatibility)");
  // Do not exit with 1 for esbuild
}
