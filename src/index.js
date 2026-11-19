#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { argv, exit } from 'node:process';

// Simple argument parser ----------------------------------------------------
const args = argv.slice(2);
let concurrency = cpus().length;
const commands = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-c' && i + 1 < args.length) {
    const val = Number(args[i + 1]);
    if (!Number.isNaN(val) && val > 0) {
      concurrency = Math.floor(val);
    }
    i++; // skip value
  } else {
    commands.push(args[i]);
  }
}
if (commands.length === 0) {
  console.error('Usage: hyperthread [-c <concurrency>] <cmd1> <cmd2> ...');
  exit(1);
}

// Semaphore implementation ---------------------------------------------------
let active = 0;
let index = 0;
let hasError = false;

function runNext() {
  if (index >= commands.length) {
    if (active === 0) {
      // All done
      exit(hasError ? 1 : 0);
    }
    return;
  }
  while (active < concurrency && index < commands.length) {
    const cmd = commands[index++];
    const cmdId = index; // 1‑based identifier for logging
    active++;
    const child = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (data) => {
      process.stdout.write(`[${cmdId}] ${data}`);
    });
    child.stderr.on('data', (data) => {
      process.stderr.write(`[${cmdId}] ${data}`);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        hasError = true;
        console.error(`[${cmdId}] exited with code ${code}`);
      }
      active--;
      runNext();
    });
  }
}

runNext();