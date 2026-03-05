#!/usr/bin/env node
/**
 * Copies the AI Gateway Cursor skill to the current project.
 * Run: pnpm exec macpaw-ai-setup-cursor
 * Or:  npx @macpaw/ai-setup-cursor (if published separately)
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', '.cursor', 'skills', 'integrate-ai-gateway');
const destDir = path.join(process.cwd(), '.cursor', 'skills');
const dest = path.join(destDir, 'integrate-ai-gateway');

if (!fs.existsSync(src)) {
  console.error('Error: Cursor skill not found. Is @macpaw/ai installed correctly?');
  process.exit(1);
}

const resolvedSrc = fs.realpathSync(src);
const resolvedDest = path.resolve(dest);
if (resolvedSrc === resolvedDest || resolvedSrc === path.resolve(destDir)) {
  console.log('✓ Cursor skill already in place at .cursor/skills/integrate-ai-gateway');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('✓ Cursor skill copied to .cursor/skills/integrate-ai-gateway');
