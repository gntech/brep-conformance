#!/usr/bin/env node
// Turns the two Vite builds into the static site: dist/client's assets plus one file per route.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(SITE, 'dist')
const OUT = join(DIST, 'site')

const manifest = JSON.parse(readFileSync(join(DIST, 'client/.vite/manifest.json'), 'utf8'))
const { prerender } = await import(join(DIST, 'server/entry-server.js'))

rmSync(OUT, { recursive: true, force: true })
cpSync(join(DIST, 'client'), OUT, { recursive: true, filter: src => !src.includes('/.vite') })
// Pages would otherwise run Jekyll, which drops files and directories starting with _.
writeFileSync(join(OUT, '.nojekyll'), '')
const files = prerender(manifest)
for (const f of files) {
  const file = join(OUT, f.file)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, f.body)
}
console.log(`prerendered ${files.length} files into ${OUT}`)
