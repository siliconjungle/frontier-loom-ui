#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { startLoomUiServer } from './index.js';

interface CliArgs {
  _: string[];
  [key: string]: string | boolean | string[];
}

export async function runFrontierLoomUiCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  try {
    if (args.help === true || args.h === true || args._[0] === 'help') {
      printHelp();
      return 0;
    }
    const port = optionalNumberArg(args.port, 'port');
    const result = await startLoomUiServer({
      cwd: stringArg(args.cwd),
      run: stringArg(args.run),
      collection: stringArg(args.collection),
      continuation: stringArg(args.continuation),
      host: stringArg(args.host),
      port
    });
    if (args.json === true) process.stdout.write(JSON.stringify({ ok: true, url: result.url }, null, 2) + '\n');
    else process.stdout.write(`frontier-loom-ui listening at ${result.url}\n`);
    if (args.open === true) openUrl(result.url);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      out._.push(token);
      continue;
    }
    const equalsIndex = token.indexOf('=');
    const key = equalsIndex === -1 ? token.slice(2) : token.slice(2, equalsIndex);
    const value = equalsIndex === -1
      ? (argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true)
      : token.slice(equalsIndex + 1);
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) (out[key] as string[]).push(String(value));
    else out[key] = [String(out[key]), String(value)];
  }
  return out;
}

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumberArg(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) throw new Error(`--${name} requires a number`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) throw new Error(`--${name} must be an integer between 0 and 65535`);
  return parsed;
}

function openUrl(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.unref();
}

function printHelp(): void {
  process.stdout.write([
    'frontier-loom-ui [options]',
    '',
    'Options:',
    '  --run <dir|swarm-results.json>',
    '  --collection <dir|collection.json>',
    '  --continuation <dir|continuation.json>',
    '  --host <host> --port <port>',
    '  --open',
    '  --json',
    ''
  ].join('\n'));
}

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isCliEntrypoint()) {
  runFrontierLoomUiCli().then((code) => {
    process.exitCode = code;
  });
}
