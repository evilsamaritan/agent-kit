#!/usr/bin/env node
// AGENTS.md is the version canon; synchronize installed package metadata.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2]
if (process.argv.length !== 3 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version ?? '')) {
  console.error('Usage: node scripts/bump-version.mjs <semver>')
  process.exit(1)
}
const outputs = new Map()
const instructions = join(root, 'AGENTS.md')
const current = readFileSync(instructions, 'utf8')
if (!/^# agent-kit v[^\n]+\n/.test(current)) throw new Error('AGENTS.md version header missing')
outputs.set(instructions, current.replace(/^# agent-kit v[^\n]+/, `# agent-kit v${version}`))
for (const relative of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.kimi-plugin/plugin.json']) {
  const path = join(root, relative)
  if (!existsSync(path)) {
    if (relative.startsWith('.kimi-plugin/')) continue
    throw new Error(`Manifest missing: ${relative}`)
  }
  const data = JSON.parse(readFileSync(path, 'utf8'))
  if (relative.endsWith('marketplace.json')) {
    const entry = data.plugins.find((plugin) => plugin.name === 'agent-kit')
    if (!entry) throw new Error('Agent Kit marketplace entry missing')
    entry.version = version
  } else data.version = version
  outputs.set(path, `${JSON.stringify(data, null, 2)}\n`)
}
for (const [path, content] of outputs) writeFileSync(path, content)
console.log(`Version ${version} synchronized in ${outputs.size} canonical locations.`)
