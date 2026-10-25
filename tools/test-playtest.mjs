#!/usr/bin/env node
// Checks js/playtest.js calls no helper that is never defined (the crash "consoleStories is not defined": a scenario
// used a name nothing declared, so the bot died before playing anything). No dependencies: the source is cut down to
// its code (comments, strings and template text blanked), every name declared anywhere in it is collected, and every
// plain call `name(` that is not a property, a declaration, a keyword or a browser/JS global must be among them.
//
//   node tools/test-playtest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Blank comments, strings and the text of templates (keeping `${ ... }` code), one character each so lines stay.
function codeOnly(src) {
  let out = '';
  const stack = []; // open templates: brace depth inside the current ${ }
  let depth = 0;
  let i = 0;
  const blank = (c) => (c === '\n' ? '\n' : ' ');
  let inTemplate = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inTemplate) {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === '`') { inTemplate = false; out += ' '; i++; continue; }
      if (c === '$' && n === '{') { stack.push(depth); depth = 0; inTemplate = false; out += '  '; i += 2; continue; }
      out += blank(c); i++; continue;
    }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; for (; i < end; i++) out += blank(src[i]); continue; }
    if (c === '"' || c === "'") {
      out += ' '; i++;
      while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { out += ' '; i++; } out += ' '; i++; }
      out += ' '; i++; continue;
    }
    if (c === '`') { inTemplate = true; out += ' '; i++; continue; }
    if (c === '/') {
      // a regex literal when it follows an operator or opening bracket
      const prev = out.replace(/\s+$/, '').slice(-1);
      if (prev === '' || /[(,=:;!&|?{}[+\-*%<>~^]/.test(prev) || /(^|[^\w$.])(return|typeof|case)$/.test(out.replace(/\s+$/, ''))) {
        out += ' '; i++;
        let cls = false;
        while (i < src.length && src[i] !== '\n' && (cls || src[i] !== '/')) {
          if (src[i] === '\\') { out += ' '; i++; } else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false;
          out += ' '; i++;
        }
        out += ' '; i++;
        while (/[a-z]/.test(src[i] || '')) { out += ' '; i++; }
        continue;
      }
    }
    if (c === '{') depth++;
    if (c === '}') {
      if (depth === 0 && stack.length) { depth = stack.pop(); inTemplate = true; out += ' '; i++; continue; }
      depth--;
    }
    out += c; i++;
  }
  return out;
}

const KEYWORDS = new Set('if for while switch catch function return typeof await async new delete void throw else do try finally in of instanceof case class super import export default yield with var let const'.split(' '));
const GLOBALS = new Set(`Array Object String Number Boolean Math JSON Date RegExp Error TypeError RangeError Promise Map Set WeakMap WeakSet Symbol
  parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI setTimeout clearTimeout setInterval clearInterval
  requestAnimationFrame cancelAnimationFrame fetch atob btoa structuredClone queueMicrotask URL URLSearchParams Blob Image Audio AudioContext
  OfflineAudioContext Event CustomEvent MouseEvent PointerEvent KeyboardEvent TouchEvent PopStateEvent HashChangeEvent InputEvent FocusEvent Promise getComputedStyle matchMedia alert
  MutationObserver IntersectionObserver ResizeObserver XMLHttpRequest Uint8Array Float32Array Int16Array ArrayBuffer DataView Intl BigInt Proxy Reflect`.split(/\s+/));

const src = fs.readFileSync(path.join(ROOT, 'js/playtest.js'), 'utf8');
const code = codeOnly(src);

const declared = new Set();
const add = (names) => names.split(/[\s,:={}[\]]+/).filter((x) => /^[A-Za-z_$][\w$]*$/.test(x)).forEach((x) => declared.add(x));
for (const m of code.matchAll(/\b(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
// const/let/var a = ..., { a, b: c } = ..., [a, b] = ...: take the names up to the = (destructuring patterns included)
for (const m of code.matchAll(/\b(?:const|let|var)\s+(\{[^=]*?\}|\[[^=]*?\]|[A-Za-z_$][\w$]*)/g)) add(m[1].replace(/\b[\w$]+\s*:/g, ''));
for (const m of code.matchAll(/\b(?:for|catch)\s*\(\s*(?:(?:const|let|var)\s+)?(\{[^)]*?\}|\[[^)]*?\]|[A-Za-z_$][\w$]*)/g)) add(m[1]);
for (const m of code.matchAll(/\bimport\s*\{([^}]*)\}/g)) add(m[1].replace(/[\w$]+\s+as\s+/g, ''));
// parameters: (a, b = 1, { c }) =>, function f(a, b), method(a), async x =>
for (const m of code.matchAll(/(?:function\*?\s*[\w$]*|\bcatch)?\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*(?:=>|\{)/g)) {
  add(m[1].replace(/=[^,]*/g, '').replace(/\.\.\./g, ' '));
}
for (const m of code.matchAll(/(?:^|[^\w$.])(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/g)) declared.add(m[1]);

const missing = new Map();
for (const m of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
  const name = m[1];
  if (KEYWORDS.has(name) || GLOBALS.has(name) || declared.has(name)) continue;
  // a method in a class or object literal: `name(...) {` at the start of a statement is a declaration
  const line = code.slice(code.lastIndexOf('\n', m.index) + 1, code.indexOf('\n', m.index));
  if (new RegExp(`^\\s*(?:async\\s+|get\\s+|set\\s+|static\\s+)?\\*?${name}\\s*\\([^)]*\\)\\s*\\{`).test(line)) continue;
  const at = code.slice(0, m.index).split('\n').length;
  if (!missing.has(name)) missing.set(name, at);
}

if (missing.size) {
  for (const [name, at] of missing) console.log(`FAIL js/playtest.js:${at} calls ${name}(), which nothing defines`);
  process.exit(1);
}
console.log(`ok   js/playtest.js: every called helper is defined (${declared.size} names declared)`);
