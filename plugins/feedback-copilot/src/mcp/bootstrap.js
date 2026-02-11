#!/usr/bin/env node

// Bootstrap: ensures dependencies are installed before starting the MCP server.
// Claude Code's plugin system clones repos but does NOT run `npm install`.
// This script handles that automatically on first run.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const nodeModules = path.join(root, 'node_modules');

if (!fs.existsSync(nodeModules)) {
  // stderr is fine — MCP uses stdin/stdout for transport, not stderr
  process.stderr.write('Feedback Copilot: installing dependencies (first run)...\n');
  execSync('npm install --silent', { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  process.stderr.write('Feedback Copilot: dependencies installed.\n');
}

require('./index.js');
