// Stamps the build into js/hawkes-build.js: window.HAWKES_BUILD = { version, commit, date }, which Hawkes Analytics
// puts on every event (AGENTS.md "Analytics"). The site has no build step, so this is run before publishing:
//
//   npm run stamp           (then commit js/hawkes-build.js)
//
// version = releases.json's current version (Studio writes it at each go live), commit = the HEAD it was run on,
// date = that commit's date. The stamp commit itself only changes this one file, so the commit named is the one
// whose pages are being published. Running it again on the same HEAD changes nothing.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const file = new URL('js/hawkes-build.js', root);
const LINE = /window\.HAWKES_BUILD = \{[^\n]*?\};/;

let version = 'dev';
try {
  version = JSON.parse(fs.readFileSync(new URL('releases.json', root), 'utf8')).current || version;
} catch {
  // No releases yet.
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const info = { version };
try {
  // The newest commit that isn't only a stamp: stamping twice in a row names the same commit.
  const head = git('log', '-1', '--format=%H %cI', '--', '.', ':(exclude)js/hawkes-build.js').split(' ');
  info.commit = head[0].slice(0, 10);
  info.date = new Date(head[1]).toISOString().replace(/\.\d+Z$/, 'Z');
} catch {
  // Not a git checkout: the version only.
}

const text = fs.readFileSync(file, 'utf8');
if (!LINE.test(text)) {
  console.error('js/hawkes-build.js has no window.HAWKES_BUILD line to stamp');
  process.exit(1);
}
const line = `window.HAWKES_BUILD = ${JSON.stringify(info)};`;
const next = text.replace(LINE, line);
if (next !== text) fs.writeFileSync(file, next);
console.log(`${next !== text ? 'stamped' : 'unchanged'} js/hawkes-build.js: ${line}`);
