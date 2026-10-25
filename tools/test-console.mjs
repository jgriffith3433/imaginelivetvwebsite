#!/usr/bin/env node
// Checks that the build refuses a broken console story (acceptance: "the build fails when a choice has no effect or a
// state has no usable choice") and builds the demo. Each case copies the demo story into a scratch folder, breaks one
// thing and runs tools/build-story.mjs there (ILTV_ROOT); it must exit 1 and say what is wrong.
//
//   node tools/test-console.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'story/night-shift-demo.json'), 'utf8'));
let failed = 0;

function build(name, change) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iltv-console-'));
  for (const d of ['tools', 'js', 'story']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(dir, 'index.html'));
  fs.symlinkSync(path.join(ROOT, 'assets'), path.join(dir, 'assets'));
  const story = structuredClone(demo);
  change(story);
  fs.writeFileSync(path.join(dir, 'story/night-shift-demo.json'), JSON.stringify(story, null, 2));
  fs.writeFileSync(path.join(dir, 'story/stories.json'), JSON.stringify({ stories: [{ id: 'night-shift-demo', logline: 'A test night.' }] }));
  const run = spawnSync(process.execPath, [path.join(dir, 'tools/build-story.mjs')], { env: { ...process.env, ILTV_ROOT: dir }, encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: run.status, out: run.stdout + run.stderr };
}

function expect(name, change, pattern) {
  const r = build(name, change);
  const ok = pattern ? r.code === 1 && pattern.test(r.out) : r.code === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n${r.out}`}`);
}
const scene = (s, id) => s.scenes.find((x) => x.id === id);

expect('the demo builds', () => {});
expect('a choice with no effect fails', (s) => {
  const c = scene(s, 'the-wall').choices[2]; // "Keep your eyes on the lobby"
  delete c.add; delete c.log; c.next = 'the-report';
  scene(s, 'the-wall').choices[0].next = 'the-report'; // and no other choice here goes anywhere else
}, /no visible effect/);
expect('a cosmetic choice passes (two at most)', (s) => {
  const c = scene(s, 'the-wall').choices[2];
  delete c.add; delete c.log; c.cosmetic = 'breath';
}, null);
expect('a state with no usable choice fails', (s) => {
  const r = scene(s, 'the-report');
  r.choices = r.choices.filter((c) => c.requires || c.meters); // "all quiet" gone: no wedge and no trust leaves nothing
}, /no usable choice/);
expect('a next target that does not exist fails', (s) => { scene(s, 'the-wall').choices[2].next = 'nowhere'; }, /doesn't exist/);
expect('an unreachable ending fails', (s) => {
  const r = scene(s, 'the-report');
  r.choices.find((c) => c.next === 'quiet-report').next = 'clean-report';
}, /no way of playing reaches this scene/);
expect('a flag nothing declared fails', (s) => { scene(s, 'the-wall').choices[2].set = ['mystery']; }, /isn't in state.flags/);
expect('a choice that can never be made fails', (s) => { scene(s, 'the-wall').choices[1].requires = ['log_quiet']; }, /can never be made|nothing sets/);
expect('too few cameras fails', (s) => { s.cameras = s.cameras.slice(0, 4); }, /monitor wall needs/);
process.exit(failed ? 1 : 0);
