#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { migrateProjectConfig } from '../../../scripts/project-migrations.mjs'

try {
  let root = process.cwd(), config, write = false
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg === '--project-root' || arg === '--config') {
      const value = process.argv[++i]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a path`)
      if (arg === '--project-root') root = resolve(value)
      else config = resolve(value)
    } else if (arg === '--write') write = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  config ??= join(root, '.agent-kit/agents.json')
  const old = JSON.parse(readFileSync(config, 'utf8'))
  const next = migrateProjectConfig(old)
  const output = `${JSON.stringify(next, null, 2)}\n`
  if (write) {
    if (JSON.stringify(old) !== JSON.stringify(next)) writeFileSync(config, output)
    console.log('Migration written. Materialize and check selected native targets next; project names and explicit skills/settings are preserved.')
  } else process.stdout.write(output)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
