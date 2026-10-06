#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const REQUIRED = ['name', 'description', 'developer_instructions', 'model_reasoning_effort', 'sandbox_mode']

function parseValue(raw, origin, lineNumber) {
  if (raw === 'true' || raw === 'false') return raw === 'true'
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`${origin}:${lineNumber}: unsupported or invalid TOML value: ${raw}`)
  }
}

function validate(path) {
  const root = {}
  const skills = []
  let table = root
  const lines = readFileSync(path, 'utf8').split('\n')

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return
    if (line === '[[skills.config]]') {
      table = {}
      skills.push(table)
      return
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(line)
    if (!match) throw new Error(`${path}:${index + 1}: invalid generated TOML line`)
    const [, key, raw] = match
    if (Object.hasOwn(table, key)) throw new Error(`${path}:${index + 1}: duplicate key ${key}`)
    table[key] = parseValue(raw, path, index + 1)
  })

  for (const key of REQUIRED) {
    if (typeof root[key] !== 'string' || !root[key]) throw new Error(`${path}: missing string ${key}`)
  }
  // Codex keeps only disabling skills.config entries from a role file, and a
  // path would pin one machine; generated targets name skills in the instructions.
  if (skills.length) throw new Error(`${path}: generated agents must not contain [[skills.config]]`)
}

if (process.argv.length < 3) {
  console.error('Usage: validate-codex-agent.mjs <agent.toml> [...]')
  process.exit(2)
}

try {
  for (const path of process.argv.slice(2)) validate(path)
  console.log(`Codex agent TOML OK: ${process.argv.length - 2} file(s).`)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
