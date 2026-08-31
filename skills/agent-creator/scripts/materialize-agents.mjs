#!/usr/bin/env node
// Materialize project agents from Agent Kit profiles and .agent-kit/agents.json.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACCESS,
  CLAUDE_COLORS,
  CLAUDE_MODELS,
  CODEX_EFFORT,
  CODEX_MODELS,
  CORE_EFFORT,
  RUNTIMES,
  composeAgent,
  isGeneratedAgent,
  loadProfiles,
  renderClaudeAgent,
  renderCodexAgent,
} from '../../../scripts/profile-lib.mjs'

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const toolkitRoot = resolve(skillRoot, '..', '..')
const CONFIG_FIELDS = new Set(['schema_version', 'agents'])
const SPEC_FIELDS = new Set(['name', 'profile', 'skills', 'runtimes', 'description', 'effort', 'access', 'claude', 'codex'])
const CLAUDE_OVERRIDE_FIELDS = new Set([
  'model',
  'color',
  'tools',
  'disallowedTools',
  'maxTurns',
  'memory',
  'background',
  'isolation',
])
const CODEX_OVERRIDE_FIELDS = new Set(['model', 'effort'])

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), check: false, prune: false, listProfiles: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--project-root') args.projectRoot = resolve(argv[++index])
    else if (arg === '--config') args.config = resolve(argv[++index])
    else if (arg === '--check') args.check = true
    else if (arg === '--prune') args.prune = true
    else if (arg === '--list-profiles') args.listProfiles = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  args.config ??= join(args.projectRoot, '.agent-kit', 'agents.json')
  return args
}

function readConfig(path) {
  if (!existsSync(path)) throw new Error(`Project agent config not found: ${path}`)
  let config
  try {
    config = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`)
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('agents.json root must be an object')
  }
  for (const key of Object.keys(config)) {
    if (!CONFIG_FIELDS.has(key)) throw new Error(`agents.json has unsupported field "${key}"`)
  }
  if (config.schema_version !== 1) throw new Error('agents.json schema_version must be 1')
  if (!Array.isArray(config.agents)) throw new Error('agents.json must contain an agents array')
  return config
}

function assertChoice(value, allowed, label) {
  if (value !== undefined && !allowed.includes(value)) {
    throw new Error(`${label} "${value}" is not one of ${allowed.join(', ')}`)
  }
}

function validateSpec(spec, profiles, names) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('Each agents entry must be an object')
  for (const key of Object.keys(spec)) {
    if (!SPEC_FIELDS.has(key)) throw new Error(`${spec.name ?? 'agent'}: unsupported field "${key}"`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.name ?? '')) {
    throw new Error(`Agent name "${spec.name}" must be lowercase kebab-case`)
  }
  if (names.has(spec.name)) throw new Error(`Duplicate project agent name: ${spec.name}`)
  names.add(spec.name)
  if (!profiles.has(spec.profile)) throw new Error(`Unknown profile "${spec.profile}" for agent "${spec.name}"`)
  if (spec.skills !== undefined && (!Array.isArray(spec.skills) || spec.skills.some((item) => typeof item !== 'string'))) {
    throw new Error(`${spec.name}: skills must be an array of names`)
  }
  if (spec.skills?.some((item) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item))) {
    throw new Error(`${spec.name}: every skill name must be lowercase kebab-case`)
  }
  if (spec.skills && new Set(spec.skills).size !== spec.skills.length) {
    throw new Error(`${spec.name}: skills must not contain duplicates`)
  }
  const runtimes = spec.runtimes ?? RUNTIMES
  if (!Array.isArray(runtimes) || runtimes.length === 0 || runtimes.some((item) => !RUNTIMES.includes(item))) {
    throw new Error(`${spec.name}: runtimes must contain claude and/or codex`)
  }
  if (new Set(runtimes).size !== runtimes.length) throw new Error(`${spec.name}: runtimes must not contain duplicates`)
  if (spec.description !== undefined && (typeof spec.description !== 'string' || !spec.description || spec.description.includes('\n'))) {
    throw new Error(`${spec.name}: description must be a non-empty single-line string`)
  }
  if (spec.claude !== undefined && (!spec.claude || typeof spec.claude !== 'object' || Array.isArray(spec.claude))) {
    throw new Error(`${spec.name}: claude must be an object`)
  }
  if (spec.codex !== undefined && (!spec.codex || typeof spec.codex !== 'object' || Array.isArray(spec.codex))) {
    throw new Error(`${spec.name}: codex must be an object`)
  }
  for (const key of Object.keys(spec.claude ?? {})) {
    if (!CLAUDE_OVERRIDE_FIELDS.has(key)) throw new Error(`${spec.name}: unsupported claude field "${key}"`)
  }
  for (const key of Object.keys(spec.codex ?? {})) {
    if (!CODEX_OVERRIDE_FIELDS.has(key)) throw new Error(`${spec.name}: unsupported codex field "${key}"`)
  }
  assertChoice(spec.effort, CORE_EFFORT, `${spec.name}: effort`)
  assertChoice(spec.access, ACCESS, `${spec.name}: access`)
  assertChoice(spec.claude?.model, CLAUDE_MODELS, `${spec.name}: claude.model`)
  assertChoice(spec.claude?.color, CLAUDE_COLORS, `${spec.name}: claude.color`)
  assertChoice(spec.codex?.model, CODEX_MODELS, `${spec.name}: codex.model`)
  assertChoice(spec.codex?.effort, CODEX_EFFORT, `${spec.name}: codex.effort`)
  if (spec.claude?.tools !== undefined && (!Array.isArray(spec.claude.tools) || spec.claude.tools.some((item) => typeof item !== 'string'))) {
    throw new Error(`${spec.name}: claude.tools must be an array of tool names`)
  }
  if (spec.claude?.disallowedTools !== undefined && (!Array.isArray(spec.claude.disallowedTools) || spec.claude.disallowedTools.some((item) => typeof item !== 'string'))) {
    throw new Error(`${spec.name}: claude.disallowedTools must be an array of tool names`)
  }
  if (spec.claude?.maxTurns !== undefined && (!Number.isInteger(spec.claude.maxTurns) || spec.claude.maxTurns < 1)) {
    throw new Error(`${spec.name}: claude.maxTurns must be a positive integer`)
  }
  assertChoice(spec.claude?.memory, ['user', 'project', 'local'], `${spec.name}: claude.memory`)
  if (spec.claude?.background !== undefined && typeof spec.claude.background !== 'boolean') {
    throw new Error(`${spec.name}: claude.background must be boolean`)
  }
  if (spec.claude?.isolation !== undefined && spec.claude.isolation !== 'worktree') {
    throw new Error(`${spec.name}: claude.isolation must be worktree`)
  }
  return runtimes
}

function resolveSkillPath(projectRoot, skill) {
  const candidates = [
    join(projectRoot, '.agents', 'skills', skill, 'SKILL.md'),
    join(projectRoot, 'skills', skill, 'SKILL.md'),
    join(toolkitRoot, 'skills', skill, 'SKILL.md'),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function expectedFiles(projectRoot, specs, profiles) {
  const files = new Map()
  const names = new Set()
  for (const spec of specs) {
    const runtimes = validateSpec(spec, profiles, names)
    const profile = profiles.get(spec.profile)
    const agent = composeAgent(profile, spec)
    const skillPaths = agent.skills.map((skill) => {
      const path = resolveSkillPath(projectRoot, skill)
      if (!path) throw new Error(`${spec.name}: skill "${skill}" is not installed in the project or Agent Kit`)
      return resolve(path)
    })
    const source = `.agent-kit/agents.json profile ${spec.profile}`
    if (runtimes.includes('claude')) {
      files.set(join(projectRoot, '.claude', 'agents', `${spec.name}.md`), renderClaudeAgent(agent, source))
    }
    if (runtimes.includes('codex')) {
      files.set(join(projectRoot, '.codex', 'agents', `${spec.name}.toml`), renderCodexAgent(agent, skillPaths, source))
    }
  }
  return files
}

function generatedFilesIn(projectRoot) {
  const files = []
  for (const dir of [join(projectRoot, '.claude', 'agents'), join(projectRoot, '.codex', 'agents')]) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isFile() && isGeneratedAgent(readFileSync(path, 'utf8'))) files.push(path)
    }
  }
  return files
}

function run() {
  const args = parseArgs(process.argv.slice(2))
  const profiles = loadProfiles(toolkitRoot)
  if (args.listProfiles) {
    for (const profile of profiles) console.log(`${profile.name}\t${profile.front.description}`)
    return
  }
  const profileMap = new Map(profiles.map((profile) => [profile.name, profile]))
  const config = readConfig(args.config)
  const files = expectedFiles(args.projectRoot, config.agents, profileMap)
  const orphans = generatedFilesIn(args.projectRoot).filter((path) => !files.has(path))

  if (args.check) {
    const stale = []
    for (const [path, content] of files) {
      if (!existsSync(path) || readFileSync(path, 'utf8') !== content) stale.push(path)
    }
    stale.push(...orphans)
    if (stale.length) {
      console.error('Project agent targets are stale:')
      for (const path of stale) console.error(`  ${path}`)
      process.exit(1)
    }
    console.log(`Project agent targets up to date: ${config.agents.length} agent(s).`)
    return
  }

  for (const [path, content] of files) {
    if (existsSync(path)) {
      const current = readFileSync(path, 'utf8')
      if (current !== content && !isGeneratedAgent(current)) {
        throw new Error(`Refusing to overwrite non-generated agent: ${path}`)
      }
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  if (args.prune) for (const path of orphans) unlinkSync(path)

  const suffix = orphans.length && !args.prune ? ` ${orphans.length} generated orphan(s) left; rerun with --prune.` : ''
  console.log(`Materialized ${files.size} runtime file(s) for ${config.agents.length} project agent(s).${suffix}`)
}

try {
  run()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
