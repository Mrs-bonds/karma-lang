#!/usr/bin/env node
// karma-cli.js (v1)
// Simple wrapper around karma-compiler.js
// Examples:
//   node karma-cli.js test.karma --pro
//   node karma-cli.js --all --pro
//   node karma-cli.js --help

import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const wantsHelp = args.includes("--help") || args.includes("-h");

if (wantsHelp || args.length === 0) {
  console.log(`
Karma CLI (v1)

Usage:
  node karma-cli.js <file.karma> [--pro]
  node karma-cli.js --all [--pro]

Notes:
  --pro enables layouts (LAYOUT="main")
`);
  process.exit(0);
}

const compilerPath = path.join(__dirname, "karma-compiler.js");

// Forward args to compiler
const result = spawnSync(process.execPath, [compilerPath, ...args], {
  stdio: "inherit",
  cwd: process.cwd()
});

process.exit(result.status ?? 0);
