#!/usr/bin/env node
/**
 * Sets up AI coding assistant integration for the current project.
 * Supports Cursor (skill), Claude Code (CLAUDE.md), and OpenAI Codex (AGENTS.md).
 *
 * Usage:
 *   pnpm exec macpaw-ai-setup          # set up all three
 *   pnpm exec macpaw-ai-setup cursor   # Cursor skill only
 *   pnpm exec macpaw-ai-setup claude   # Claude Code only
 *   pnpm exec macpaw-ai-setup codex    # OpenAI Codex only
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const projectRoot = process.cwd();

if (fs.realpathSync(pkgRoot) === fs.realpathSync(projectRoot)) {
  console.log('ℹ  Running inside the @macpaw/ai-sdk repo itself — nothing to copy.');
  process.exit(0);
}

const tool = process.argv[2]?.toLowerCase();
const validTools = ['cursor', 'claude', 'codex'];

if (tool && !validTools.includes(tool)) {
  console.error(`Unknown tool "${tool}". Valid options: ${validTools.join(', ')} (or omit to set up all).`);
  process.exit(1);
}

const all = !tool;
const results = [];

// --- Cursor Skill ---
if (all || tool === 'cursor') {
  const packagedCursorSkill = path.join(pkgRoot, 'templates', 'cursor', 'skills', 'integrate-ai-gateway');
  const repoCursorSkill = path.join(pkgRoot, '.cursor', 'skills', 'integrate-ai-gateway');
  const src = fs.existsSync(packagedCursorSkill) ? packagedCursorSkill : repoCursorSkill;
  const destDir = path.join(projectRoot, '.cursor', 'skills');
  const dest = path.join(destDir, 'integrate-ai-gateway');

  if (!fs.existsSync(src)) {
    results.push('✗ Cursor skill source not found (is @macpaw/ai-sdk installed?)');
  } else {
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    results.push('✓ Cursor skill → .cursor/skills/integrate-ai-gateway/');
  }
}

// --- Claude Code (CLAUDE.md) ---
if (all || tool === 'claude') {
  results.push(copyMarkdownTemplate('CLAUDE.md', 'Claude Code'));
}

// --- OpenAI Codex (AGENTS.md) ---
if (all || tool === 'codex') {
  results.push(copyMarkdownTemplate('AGENTS.md', 'OpenAI Codex'));
}

console.log('\n  @macpaw/ai-sdk — AI Assistant Setup\n');
results.forEach((r) => console.log(`  ${r}`));
console.log('\n  Now ask your AI assistant: "Integrate AI Gateway into this app"\n');

// ---------------------------------------------------------------------------

function copyMarkdownTemplate(filename, toolName) {
  const src = path.join(pkgRoot, 'templates', filename);
  const dest = path.join(projectRoot, filename);

  if (!fs.existsSync(src)) {
    return `✗ ${filename} template not found (is @macpaw/ai-sdk installed?)`;
  }

  const content = fs.readFileSync(src, 'utf8');

  if (fs.existsSync(dest)) {
    const existing = fs.readFileSync(dest, 'utf8');
    if (existing.includes('@macpaw/ai-sdk')) {
      return `· ${filename} already contains AI Gateway instructions — skipped`;
    }
    fs.appendFileSync(dest, '\n\n' + content);
    return `✓ AI Gateway instructions appended to existing ${filename} (${toolName})`;
  }

  fs.writeFileSync(dest, content);
  return `✓ ${filename} created (${toolName})`;
}
