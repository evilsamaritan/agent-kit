#!/usr/bin/env node
// Compile reusable profession profiles into package-owned runtime artifacts.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadProfiles,
  renderProfileCatalog,
  renderProfileReference,
} from './profile-lib.mjs'

const toolkitRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const profileReferenceTarget = join(toolkitRoot, 'skills', 'agent-orchestrator', 'references', 'profiles')
const catalogTarget = join(toolkitRoot, 'skills', 'agent-orchestrator', 'references', 'profile-catalog.md')

function collect(profiles) {
  const files = new Map()
  for (const profile of profiles) {
    files.set(join(profileReferenceTarget, `${profile.name}.md`), renderProfileReference(profile))
  }
  files.set(catalogTarget, renderProfileCatalog(profiles))
  return files
}

let profiles
try {
  profiles = loadProfiles(toolkitRoot)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(toolkitRoot, '.claude-plugin/plugin.json'), 'utf8'))
if (Object.hasOwn(manifest, 'agents') || existsSync(join(toolkitRoot, '.claude-plugin/agents'))) {
  console.error('Agent Kit ships profiles and skills, not bundled Claude agents. Remove package agent targets and the manifest agents field.')
  process.exit(1)
}

const files = collect(profiles)
const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  const stale = []
  for (const [path, content] of files) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (current !== content) stale.push(path.slice(toolkitRoot.length + 1))
  }
  for (const dir of [profileReferenceTarget]) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isFile() && !files.has(path)) stale.push(`${path.slice(toolkitRoot.length + 1)} (orphan)`)
    }
  }
  if (stale.length) {
    console.error('Generated profile targets are stale. Run scripts/generate-profiles.mjs:')
    for (const path of stale) console.error(`  ${path}`)
    process.exit(1)
  }
  console.log(`Profile targets up to date: ${profiles.length} profile(s).`)
} else {
  for (const dir of [profileReferenceTarget]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true })
    mkdirSync(dir, { recursive: true })
  }
  for (const [path, content] of files) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  console.log(`Generated ${files.size} file(s) from ${profiles.length} profile(s).`)
}
