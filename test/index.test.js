import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile, rm } from 'node:fs/promises';

const cliPath = resolve('src', 'index.js');

test('executes multiple commands concurrently with default concurrency', async (t) => {
  const proc = spawn('node', [cliPath, 'node -e "process.stdout.write(\'A\')"', 'node -e "process.stdout.write(\'B\')"'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  for await (const chunk of proc.stdout) {
    stdout += chunk.toString();
  }
  const exitCode = await new Promise((resolve) => proc.on('close', resolve));
  assert.equal(exitCode, 0, 'process should exit with code 0');
  assert.ok(stdout.includes('[1] A'), 'output should contain first command marker');
  assert.ok(stdout.includes('[2] B'), 'output should contain second command marker');
});

test('respects user‑defined concurrency limit', async (t) => {
  // Two commands that each wait 200 ms before printing
  const cmd1 = 'node -e "setTimeout(()=>process.stdout.write(\'X\'),200)"';
  const cmd2 = 'node -e "setTimeout(()=>process.stdout.write(\'Y\'),200)"';
  const proc = spawn('node', [cliPath, '-c', '1', cmd1, cmd2], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const start = Date.now();
  let stdout = '';
  for await (const chunk of proc.stdout) {
    stdout += chunk.toString();
  }
  const exitCode = await new Promise((resolve) => proc.on('close', resolve));
  const duration = Date.now() - start;
  assert.equal(exitCode, 0, 'process should exit with code 0');
  // With concurrency 1 the total time should be at least 400 ms
  assert.ok(duration >= 350, `expected duration >= 350 ms, got ${duration} ms`);
  assert.ok(stdout.includes('[1] X'), 'first command output present');
  assert.ok(stdout.includes('[2] Y'), 'second command output present');
});