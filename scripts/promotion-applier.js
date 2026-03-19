#!/usr/bin/env node
/**
 * promotion-applier.js — Last-mile: reads pending promotion suggestions,
 * uses LLM to distill them into concise rules, and appends them to the
 * appropriate workspace files (AGENTS.md, TOOLS.md, SOUL.md).
 *
 * Safety:
 * - Only APPENDS to a clearly marked "## Auto-Promoted Rules" section
 * - Never overwrites existing content
 * - Creates backup before writing
 * - Marks processed suggestions as 'promoted' in DB
 * - Deduplicates: skips rules whose distilled text already exists in the file
 * - Dry-run mode by default (pass --apply to actually write)
 *
 * Usage:
 *   node scripts/promotion-applier.js [--apply] [--limit 10] [--json] [--min-recurrence 5]
 */

try {
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.configDotenv({ path: process.env.BRAINX_ENV || path.join(__dirname, '..', '.env') });
} catch (_) {}

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// --- Config ---
const WORKSPACE_DIRS = [
  '/home/clawd/.openclaw/workspace',
  ...fs.readdirSync('/home/clawd/.openclaw').filter(d => d.startsWith('workspace-')).map(d => `/home/clawd/.openclaw/${d}`)
];
const SECTION_MARKER = '## Auto-Promoted Rules';
const SECTION_FOOTER = '<!-- END AUTO-PROMOTED RULES -->';

function parseArgs(argv) {
  const args = { apply: false, limit: 10, json: false, minRecurrence: 5 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    if (argv[i] === '--limit' && argv[i + 1]) args.limit = parseInt(argv[i + 1], 10) || 10;
    if (argv[i] === '--json') args.json = true;
    if (argv[i] === '--min-recurrence' && argv[i + 1]) args.minRecurrence = parseInt(argv[i + 1], 10) || 5;
  }
  return args;
}

function getDb() {
  return require(path.join(__dirname, '..', 'lib', 'db'));
}

async function distillWithLLM(suggestions) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const grouped = { 'AGENTS.md': [], 'TOOLS.md': [], 'SOUL.md': [] };
  for (const s of suggestions) {
    const target = s.target_file || 'AGENTS.md';
    if (!grouped[target]) grouped[target] = [];
    grouped[target].push(s);
  }

  const results = {};
  for (const [file, items] of Object.entries(grouped)) {
    if (items.length === 0) continue;

    const itemsText = items.map((s, i) =>
      `${i + 1}. [${s.recurrence}x] ${s.description?.slice(0, 300) || s.content?.slice(0, 300)}`
    ).join('\n');

    const resp = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `You distill recurring patterns into concise operational rules for an AI agent workspace.
Rules must be:
- One line each, starting with "- " (markdown bullet)
- Actionable and specific (not vague)
- In Spanish (matching workspace language)
- Deduplicated (merge similar patterns into one rule)
- Maximum 15 rules total, even if there are more patterns
- Include the recurrence count as context: e.g. "- [×23] Nunca modificar HTML original en migración — solo ajustar paths de recursos."

Target file context:
- AGENTS.md: workflow rules, execution patterns, project-specific decisions
- TOOLS.md: CLI/API patterns, infrastructure configs, tool-specific gotchas
- SOUL.md: behavioral patterns, communication style, personality rules

Output ONLY the bullet list. No headers, no explanation.`
        },
        {
          role: 'user',
          content: `Distill these ${items.length} recurring patterns (for ${file}) into concise rules:\n\n${itemsText}`
        }
      ]
    });

    const rules = resp.choices[0].message.content.trim();
    results[file] = { rules, sourceIds: items.map(i => i.id), count: items.length };
  }

  return results;
}

function ensureSection(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(SECTION_MARKER)) {
    // Append section at end
    const addition = `\n\n---\n\n${SECTION_MARKER}\n\n_Reglas auto-promovidas por BrainX desde patrones recurrentes. Última actualización: ${new Date().toISOString().split('T')[0]}_\n\n${SECTION_FOOTER}\n`;
    fs.writeFileSync(filePath, content + addition, 'utf-8');
  }
  return true;
}

function appendRules(filePath, newRules) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const footerIdx = content.indexOf(SECTION_FOOTER);
  if (footerIdx === -1) return { written: 0, skipped: 0 };

  // Extract existing rules to dedup
  const markerIdx = content.indexOf(SECTION_MARKER);
  const existingSection = content.slice(markerIdx, footerIdx);

  const lines = newRules.split('\n').filter(l => l.trim().startsWith('- '));
  let written = 0;
  let skipped = 0;
  const toAppend = [];

  for (const line of lines) {
    // Simple dedup: check if a substantially similar line exists
    const core = line.replace(/^- \[×\d+\]\s*/, '').trim().toLowerCase().slice(0, 60);
    if (existingSection.toLowerCase().includes(core)) {
      skipped++;
      continue;
    }
    toAppend.push(line);
    written++;
  }

  if (toAppend.length === 0) return { written: 0, skipped };

  // Update timestamp
  const dateStr = new Date().toISOString().split('T')[0];
  let updatedContent = content.slice(0, footerIdx);
  // Update the "Última actualización" line
  updatedContent = updatedContent.replace(
    /_Reglas auto-promovidas.*?_\n/,
    `_Reglas auto-promovidas por BrainX desde patrones recurrentes. Última actualización: ${dateStr}_\n`
  );
  updatedContent += toAppend.join('\n') + '\n\n' + content.slice(footerIdx);
  fs.writeFileSync(filePath, updatedContent, 'utf-8');

  return { written, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = getDb();

  console.log(`🔄 Promotion Applier ${args.apply ? '(APPLY MODE)' : '(DRY-RUN)'}...\n`);

  // Fetch pending suggestions from auto-promoter
  const { rows: suggestions } = await db.query(`
    SELECT m.id, m.content, m.created_at,
           p.pattern_key, p.recurrence_count, p.last_category
    FROM brainx_memories m
    LEFT JOIN brainx_patterns p ON m.content LIKE '%' || p.pattern_key || '%'
    WHERE 'promotion-suggestion' = ANY(m.tags)
      AND m.status != 'promoted'
    ORDER BY p.recurrence_count DESC NULLS LAST, m.created_at DESC
    LIMIT $1
  `, [args.limit]);

  if (suggestions.length === 0) {
    console.log('✅ No pending promotion suggestions.');
    try { await db.end(); } catch (_) {}
    return;
  }

  // Parse target file and description from the stored suggestion content
  const parsed = suggestions.map(s => {
    const match = s.content.match(/→\s*(AGENTS\.md|TOOLS\.md|SOUL\.md)/);
    const descMatch = s.content.match(/Rule:\s*(.+)/);
    const recMatch = s.content.match(/Recurrence:\s*(\d+)x/);
    return {
      id: s.id,
      target_file: match?.[1] || 'AGENTS.md',
      description: descMatch?.[1] || s.content.slice(0, 200),
      recurrence: parseInt(recMatch?.[1]) || s.recurrence_count || 3,
      pattern_key: s.pattern_key,
      content: s.content,
    };
  }).filter(s => s.recurrence >= args.minRecurrence);

  if (parsed.length === 0) {
    console.log(`✅ No suggestions meet minimum recurrence threshold (${args.minRecurrence}x).`);
    try { await db.end(); } catch (_) {}
    return;
  }

  console.log(`📋 ${parsed.length} suggestions above ${args.minRecurrence}x recurrence, distilling with LLM...\n`);

  // Distill rules
  const distilled = await distillWithLLM(parsed);
  const summary = { files: {}, totalWritten: 0, totalSkipped: 0 };

  for (const [file, data] of Object.entries(distilled)) {
    console.log(`\n📄 ${file} (${data.count} patterns → distilled rules):`);
    console.log(data.rules);

    if (args.apply) {
      // Write to ALL workspaces that have this file
      let filesUpdated = 0;
      for (const wsDir of WORKSPACE_DIRS) {
        const filePath = path.join(wsDir, file);
        if (!fs.existsSync(filePath)) continue;

        // Backup
        const backupPath = filePath + `.bak.promo.${Date.now()}`;
        fs.copyFileSync(filePath, backupPath);

        // Ensure section exists
        ensureSection(filePath);

        // Append rules
        const result = appendRules(filePath, data.rules);
        if (result.written > 0) {
          filesUpdated++;
          console.log(`  ✅ ${filePath}: ${result.written} rules added, ${result.skipped} skipped (dedup)`);
        } else {
          console.log(`  ⏭️ ${filePath}: all rules already exist, skipped`);
          // Remove unnecessary backup
          try { fs.unlinkSync(backupPath); } catch (_) {}
        }
        summary.totalWritten += result.written;
        summary.totalSkipped += result.skipped;
      }
      summary.files[file] = { patternsDistilled: data.count, filesUpdated };

      // Mark source memories as promoted
      for (const id of data.sourceIds) {
        await db.query(`UPDATE brainx_memories SET status = 'promoted' WHERE id = $1`, [id]);
      }
    } else {
      summary.files[file] = { patternsDistilled: data.count, rulesPreview: data.rules.split('\n').length };
    }
  }

  // Also mark the original patterns as promoted
  if (args.apply) {
    const allPatternKeys = parsed.map(p => p.pattern_key).filter(Boolean);
    for (const key of [...new Set(allPatternKeys)]) {
      await db.query(`UPDATE brainx_patterns SET promoted_to = 'auto', last_status = 'promoted', updated_at = NOW() WHERE pattern_key = $1`, [key]);
    }
    console.log(`\n🏷️ Marked ${allPatternKeys.length} patterns as promoted.`);
  }

  if (args.json) {
    console.log(JSON.stringify({ ok: true, mode: args.apply ? 'apply' : 'dry-run', summary }, null, 2));
  } else {
    console.log(`\n📊 Summary: ${summary.totalWritten} rules written, ${summary.totalSkipped} skipped (dedup)`);
    if (!args.apply) {
      console.log('\n⚠️  DRY-RUN — pass --apply to write to workspace files.');
    }
  }

  try { await db.end(); } catch (_) {}
}

main().catch(e => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
