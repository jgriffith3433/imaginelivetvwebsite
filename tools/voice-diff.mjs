// Lists the nodes whose text changed in each story since a git ref, and writes docs/voice-diff.md.
//   node tools/voice-diff.mjs [base-ref]     (default: the commit before the writing pass, see BASE below)
// "Text" is a scene's title, story, question, lines, choice labels and ending. Nothing else counts as a change.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const BASE = process.argv[2] || '6c0d6ef'; // main before the writing pass
const stories = JSON.parse(readFileSync('story/stories.json', 'utf8'));
const list = (stories.stories || stories).map((s) => s.id).filter((id) => id !== 'night-shift-demo');
const textOf = (s) => JSON.stringify([s.title, s.story, s.question, s.ending, (s.choices || []).map((c) => [c.say, c.en]), (s.lines || []).map((l) => [l.speaker, l.text])]);
const old = (id) => { try { return JSON.parse(execSync(`git show ${BASE}:story/${id}.json`, { encoding: 'utf8', maxBuffer: 1 << 28 })); } catch { return null; } };
let out = `# Writing pass: changed nodes per story\n\nBase: \`${BASE}\`. A node is a scene; it counts as changed when its title, text, question, lines, ending or choice labels differ. No node was added or removed unless listed.\n\n`;
for (const id of list) {
  const now = JSON.parse(readFileSync(`story/${id}.json`, 'utf8'));
  const before = old(id);
  const prev = new Map((before?.scenes || []).map((s) => [s.id, s]));
  const changed = now.scenes.filter((s) => prev.has(s.id) && textOf(s) !== textOf(prev.get(s.id))).map((s) => s.id);
  const added = now.scenes.filter((s) => !prev.has(s.id)).map((s) => s.id);
  const gone = [...prev.keys()].filter((k) => !now.scenes.some((s) => s.id === k));
  out += `## ${id}\n\n- Scenes: ${now.scenes.length} (before: ${prev.size}); removed: ${gone.length}; added: ${added.length}\n- Changed nodes: ${changed.length}\n`;
  for (const c of changed) out += `  - \`${c}\`\n`;
  out += '\n';
}
writeFileSync('docs/voice-diff.md', out);
console.log(out);
