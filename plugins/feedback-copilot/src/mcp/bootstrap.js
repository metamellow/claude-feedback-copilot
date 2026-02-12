#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const nodeModules = path.join(root, 'node_modules');

if (!fs.existsSync(nodeModules)) {
  process.stderr.write('Feedback Copilot: installing dependencies (first run)...\n');
  execSync('npm install --silent', { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  process.stderr.write('Feedback Copilot: dependencies installed.\n');
}

require('./index.js');
