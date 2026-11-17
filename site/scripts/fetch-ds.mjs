// Fetches the Springcraft design system's published build into .ds/, checked against pinned
// hashes, and wraps its script as a module over the site's own React. Runs on npm install.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// A build's files never change: a new build gets a new path, and these hashes with it.
const BASE = 'https://cdn.springcraft.ai/design/sc-1.1/mwl4jqxo/'
const FILES = {
  'sc.js': 'f00a71d4cbec6d5ece2568912c798971d33e0b080ff280b926d07d008f1fbe71',
  'sc.css': 'b2a996cb74205339c2d8ec1e319107afafcf99a00b532d891c227886a09a8bf1',
  'sc.d.ts': 'ac810258671de205cdd70ad1a5ae79ec27d78a1207d4af9a41e3198ecff2311a',
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../.ds')
const stamp = resolve(out, 'build.txt')
if (existsSync(stamp) && readFileSync(stamp, 'utf8') === BASE) process.exit(0)
mkdirSync(out, { recursive: true })

const text = {}
for (const [name, sha] of Object.entries(FILES)) {
  const res = await fetch(BASE + name)
  if (!res.ok) throw new Error(`${BASE}${name}: HTTP ${res.status}`)
  const body = Buffer.from(await res.arrayBuffer())
  const got = createHash('sha256').update(body).digest('hex')
  if (got !== sha) throw new Error(`${BASE}${name}: sha256 ${got}, expected ${sha}`)
  text[name] = body.toString('utf8')
}

// The script reads React from the page's global; the module takes the site's instead.
const uses = text['sc.js'].split('globalThis.React').length - 1
if (uses !== 1) throw new Error(`sc.js reads globalThis.React ${uses} times, expected 1`)
writeFileSync(
  resolve(out, 'sc.mjs'),
  "import * as SiteReact from 'react'\n" +
    text['sc.js'].replace('globalThis.React', 'SiteReact') +
    '\nexport default SC\n',
)
writeFileSync(
  resolve(out, 'sc.d.mts'),
  '/// <reference path="./sc.d.ts" />\ndeclare const build: typeof SC\nexport default build\n',
)
writeFileSync(resolve(out, 'sc.d.ts'), text['sc.d.ts'])
// The site serves its fonts itself, so the build's import of them from Google Fonts is dropped.
const css = text['sc.css'].replace(/@import\s*"https:\/\/fonts\.googleapis\.com[^"]*"\s*;/, '')
if (css.includes('fonts.googleapis.com')) throw new Error('sc.css: the font import was not removed')
writeFileSync(resolve(out, 'sc.css'), css)
writeFileSync(stamp, BASE)
