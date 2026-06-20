import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.dirname(packageDir);
const typecheck = process.argv.includes('--typecheck');

linkLocalPackages();
if (!typecheck) fs.rmSync(path.join(packageDir, 'dist'), { recursive: true, force: true });
runTsc(typecheck ? ['-p', 'tsconfig.json', '--noEmit'] : ['-p', 'tsconfig.json']);
if (!typecheck) {
  fs.cpSync(path.join(packageDir, 'public'), path.join(packageDir, 'dist', 'public'), { recursive: true });
  fs.chmodSync(path.join(packageDir, 'dist', 'cli.js'), 0o755);
}

function linkLocalPackages() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const names = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {})
  ]);
  for (const name of names) {
    if (!name.startsWith('@shapeshift-labs/')) continue;
    const target = localPackageDir(name) ?? installedPackageDir(name);
    if (target) linkPackage(name, target);
  }
}

function localPackageDir(name) {
  if (!name.startsWith('@shapeshift-labs/')) return null;
  const dir = path.join(workspaceDir, name.slice('@shapeshift-labs/'.length));
  return fs.existsSync(path.join(dir, 'package.json')) ? dir : null;
}

function installedPackageDir(name) {
  for (const root of ['loom', 'frontier-swarm-codex']) {
    const dir = path.join(workspaceDir, root, 'node_modules', ...name.split('/'));
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return null;
}

function linkPackage(name, targetDir) {
  const parts = name.split('/');
  const linkPath = path.join(packageDir, 'node_modules', ...parts);
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink() && fs.readlinkSync(linkPath) === path.relative(path.dirname(linkPath), targetDir)) {
      linkPackageBins(name, linkPath, targetDir);
      return;
    }
    if (stat.isSymbolicLink()) fs.unlinkSync(linkPath);
    else return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  fs.symlinkSync(path.relative(path.dirname(linkPath), targetDir), linkPath, 'dir');
  linkPackageBins(name, linkPath, targetDir);
}

function linkPackageBins(name, linkPath, targetDir) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
  const entries = typeof packageJson.bin === 'string'
    ? [[name.split('/').pop(), packageJson.bin]]
    : Object.entries(packageJson.bin ?? {});
  if (!entries.length) return;
  const binDir = path.join(packageDir, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  for (const [binName, binPath] of entries) {
    if (!binName || typeof binPath !== 'string') continue;
    const shimPath = path.join(binDir, binName);
    const scriptPath = path.relative(binDir, path.join(linkPath, binPath)).replaceAll(path.sep, '/');
    try {
      fs.unlinkSync(shimPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    fs.writeFileSync(shimPath, [
      '#!/usr/bin/env node',
      "const { spawnSync } = require('node:child_process');",
      "const path = require('node:path');",
      `const script = path.resolve(__dirname, ${JSON.stringify(scriptPath)});`,
      "const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: 'inherit' });",
      'process.exit(result.status ?? 1);',
      ''
    ].join('\n'));
    fs.chmodSync(shimPath, 0o755);
  }
}

function runTsc(args) {
  const script = [
    path.join(packageDir, 'node_modules', 'typescript', 'bin', 'tsc'),
    path.join(workspaceDir, 'loom', 'node_modules', 'typescript', 'bin', 'tsc'),
    path.join(workspaceDir, 'frontier-swarm-codex', 'node_modules', 'typescript', 'bin', 'tsc')
  ].find((file) => fs.existsSync(file));
  execFileSync(process.execPath, [script ?? 'node_modules/typescript/bin/tsc', ...args], { cwd: packageDir, stdio: 'inherit' });
}
