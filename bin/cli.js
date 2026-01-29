#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

console.log("========================================");
console.log("      Redmine Tracker CLI Tool");
console.log("========================================");

const sourceDir = path.resolve(__dirname, '..');
const currentDir = process.cwd();
const ignoreList = ['node_modules', '.git', '.venv', '__pycache__', 'dist', 'release', 'backend/build', 'backend/dist', '.idea', '.vscode'];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(childItemName => {
            if (ignoreList.includes(childItemName)) return;
            if (src.endsWith('backend') && (['build', 'dist', '__pycache__', '.venv'].includes(childItemName))) return;
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

async function main() {
    console.log(`\nThis tool will set up Redmine Tracker.`);

    // 1. Determine Target Directory
    let targetDir = currentDir;
    const createSubdir = await ask('\nCreate a new subdirectory for the project? (default: redmine-tracker) [Y/n]: ');
    if (createSubdir.toLowerCase() !== 'n') {
        targetDir = path.join(currentDir, 'redmine-tracker');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
        console.log(`\nTarget Directory: ${targetDir}`);
    } else {
        console.log(`\nTarget Directory: ${targetDir} (Current)`);
        console.log("⚠️  Warning: This will overwrite files in the current directory.");
    }

    // 2. Scaffolding
    const confirmCopy = await ask('\nInitialize/Copy project files here? [Y/n]: ');
    if (confirmCopy.toLowerCase() === 'n') {
        console.log('Aborted.');
        rl.close();
        return;
    }

    console.log('📂 Copying files...');
    try {
        copyRecursiveSync(sourceDir, targetDir);
        console.log('✅ Files copied successfully.');
    } catch (err) {
        console.error('❌ Error copying files:', err);
        rl.close();
        return;
    }

    // 3. Installation
    const confirmInstall = await ask('\nAutomatically install dependencies (npm & python)? This may take a few minutes. [Y/n]: ');
    if (confirmInstall.toLowerCase() !== 'n') {
        console.log('\n📦 Installing Node modules (npm install)...');
        try {
            execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
            console.log('✅ Node modules installed.');
        } catch (e) {
            console.error('❌ npm install failed.');
        }

        console.log('\n🐍 Setting up Python environment...');
        try {
            const isWin = process.platform === 'win32';
            // Create venv
            console.log('   Creating virtual environment (.venv)...');
            execSync(`python -m venv .venv`, { cwd: targetDir, stdio: 'inherit' });

            // Install reqs
            const pipCmd = isWin ? '.\\.venv\\Scripts\\pip' : './.venv/bin/pip';
            console.log('   Installing Python dependencies...');
            execSync(`${pipCmd} install -r backend/requirements.txt`, { cwd: targetDir, stdio: 'inherit' });
            console.log('✅ Python setup complete.');
        } catch (e) {
            console.error('❌ Python setup failed. Ensure python is installed and on PATH.');
        }
    } else {
        console.log('\nSkipping installation.');
        console.log('You will need to run: npm install && python setup manually.');
    }

    // 4. Run
    const confirmRun = await ask('\n🚀 Launch Redmine Tracker now? [Y/n]: ');
    if (confirmRun.toLowerCase() !== 'n') {
        console.log('\nStarting application...');
        console.log('Press Ctrl+C to stop.');

        // Spawn npm run dev
        // We use spawn to keep it interactive/streamed and separate process
        const npmCmd = 'npm';
        const app = spawn(npmCmd, ['run', 'dev'], { cwd: targetDir, stdio: 'inherit', shell: true });

        app.on('close', (code) => {
            console.log(`Application exited with code ${code}`);
            rl.close();
        });
    } else {
        console.log('\n✅ Setup complete!');
        console.log(`\nTo start the app later, run:\n  cd "${path.relative(currentDir, targetDir)}"\n  npm run dev`);
        rl.close();
    }
}

main();
