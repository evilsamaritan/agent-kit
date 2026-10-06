#!/usr/bin/env node
// Materialize project agents from Agent Kit profiles and .agent-kit/agents.json.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACCESS,
  CORE_EFFORT,
  DEFAULT_RUNTIMES,
  RUNTIMES,
  composeAgent,
  compositionFingerprint,
  isGeneratedAgent,
  kitVersion,
  loadProfiles,
  renderAgentBrief,
  renderTarget,
  runtimeRegistry,
} from '../../../scripts/profile-lib.mjs'
import { compareTargets, portabilityIssues, skillLocator } from '../../../scripts/profile-runtimes/shared.mjs'
import { RENAMED_SKILLS } from '../../../scripts/project-migrations.mjs'

const toolkitRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
// Literal local paths that must never reach a target; the structural and pattern
// checks in portabilityIssues cover other machines.
const MACHINE_PATHS = [toolkitRoot, homedir()]
const CONFIG_FIELDS = new Set(['schema_version', 'agents'])
const SPEC_FIELDS = new Set(['name', 'profile', 'skills', 'runtimes', 'description', 'effort', 'access', ...RUNTIMES])
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RETIRED_PROFILES = new Set(['frontend', 'backend'])

const USAGE = `Usage: materialize-agents.mjs [--project-root DIR] [--config FILE] [options]

  (default)        write native targets and print what changed
  --dry-run        print the semantic diff without writing
  --check          fail when a target is missing, changed, orphaned, or not portable
  --agent NAME     limit --check/--dry-run/writing to one project agent
  --prune          also delete generated targets no longer in the config
  --brief NAME     print a generic-subagent brief for one project agent
  --list-profiles  list bundled profession profiles`

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), check: false, prune: false, dryRun: false, portable: false, listProfiles: false }
  const value = (index, flag) => {
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) throw new Error(`${flag} requires a value`)
    return next
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--project-root') args.projectRoot = resolve(value(index++, arg))
    else if (arg === '--config') args.config = resolve(value(index++, arg))
    else if (arg === '--brief') args.brief = value(index++, arg)
    else if (arg === '--agent') args.agent = value(index++, arg)
    else if (arg === '--check') args.check = true
    // Deprecated in 4.0.0-rc.2: targets are portable by construction.
    else if (arg === '--portable') args.portable = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--prune') args.prune = true
    else if (arg === '--list-profiles') args.listProfiles = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}\n\n${USAGE}`)
  }
  if (args.portable) console.error('note: --portable is deprecated and has no effect; generated targets are portable, so --check compares them exactly.')
  if (args.brief && (args.check || args.prune || args.dryRun)) throw new Error('--brief cannot be combined with --check, --dry-run, or --prune')
  if (args.agent && args.prune) throw new Error('--prune works on the whole project; drop --agent')
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
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('agents.json root must be an object')
  for (const key of Object.keys(config)) {
    if (!CONFIG_FIELDS.has(key)) throw new Error(`agents.json has unsupported field "${key}"`)
  }
  if (config.schema_version !== 1) throw new Error('agents.json schema_version must be 1')
  if (!Array.isArray(config.agents)) throw new Error('agents.json must contain an agents array')
  return config
}

function validateSpec(spec, profiles, names) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('Each agents entry must be an object')
  const label = spec.name ?? 'agent'
  for (const key of Object.keys(spec)) {
    if (!SPEC_FIELDS.has(key)) throw new Error(`${label}: unsupported field "${key}"`)
  }
  if (!NAME.test(spec.name ?? '')) throw new Error(`Agent name "${spec.name}" must be lowercase kebab-case`)
  if (names.has(spec.name)) throw new Error(`Duplicate project agent name: ${spec.name}`)
  names.add(spec.name)
  if (!profiles.has(spec.profile)) {
    const hint = RETIRED_PROFILES.has(spec.profile)
      ? '; migrate to developer with skills/agent-creator/scripts/migrate-project.mjs (preview by default, --write to apply)'
      : ''
    throw new Error(`Unknown profile "${spec.profile}" for agent "${spec.name}"${hint}`)
  }
  if (spec.skills !== undefined) {
    if (!Array.isArray(spec.skills) || spec.skills.some((item) => typeof item !== 'string' || !NAME.test(item))) {
      throw new Error(`${spec.name}: skills must be an array of kebab-case skill names`)
    }
    if (new Set(spec.skills).size !== spec.skills.length) throw new Error(`${spec.name}: skills must not contain duplicates`)
  }
  const runtimes = spec.runtimes ?? DEFAULT_RUNTIMES
  if (!Array.isArray(runtimes) || runtimes.length === 0 || runtimes.some((item) => !RUNTIMES.includes(item))) {
    throw new Error(`${spec.name}: runtimes must be a non-empty subset of ${RUNTIMES.join(', ')}`)
  }
  if (new Set(runtimes).size !== runtimes.length) throw new Error(`${spec.name}: runtimes must not contain duplicates`)
  for (const id of runtimes) {
    if (runtimeRegistry.get(id).reservedNames?.includes(spec.name)) {
      throw new Error(`${spec.name}: the name is reserved by a built-in ${runtimeRegistry.get(id).label} agent; choose another name`)
    }
  }
  if (spec.description !== undefined && (typeof spec.description !== 'string' || !spec.description.trim() || spec.description.includes('\n'))) {
    throw new Error(`${spec.name}: description must be a non-empty single-line string`)
  }
  if (spec.effort !== undefined && !CORE_EFFORT.includes(spec.effort)) throw new Error(`${spec.name}: effort must be one of ${CORE_EFFORT.join(', ')}`)
  if (spec.access !== undefined && !ACCESS.includes(spec.access)) throw new Error(`${spec.name}: access must be one of ${ACCESS.join(', ')}`)
  for (const runtime of runtimeRegistry.values()) {
    if (spec[runtime.id] !== undefined) runtime.validate(spec[runtime.id], `${spec.name}: ${runtime.id}`)
  }
  return runtimes
}

// Hosts never preload or model-invoke a skill that opts out of model invocation.
const modelInvocable = (path) => !/^disable-model-invocation:\s*true\s*$/m.test(/^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, 'utf8'))?.[1] ?? '')

// Project-local skills win over the installed library, in the runtime's own
// discovery order. Report a shadowed library skill instead of hiding it.
// `directory` and `relative` locate a project skill inside the project (POSIX).
function resolveSources(projectRoot, directories, skills, label) {
  return skills.map((name) => {
    const libraryPath = join(toolkitRoot, 'skills', name, 'SKILL.md')
    for (const directory of directories) {
      const path = join(projectRoot, directory, name, 'SKILL.md')
      if (existsSync(path)) {
        const shadows = existsSync(libraryPath) && resolve(path) !== resolve(libraryPath)
        return { name, absolute: path, directory, relative: relative(projectRoot, path).split(sep).join('/'), project: true, shadows, invocable: modelInvocable(path) }
      }
    }
    if (existsSync(libraryPath)) return { name, absolute: libraryPath, project: false, shadows: false, invocable: modelInvocable(libraryPath) }
    const renamed = RENAMED_SKILLS[name]
      ? `; it was renamed to "${RENAMED_SKILLS[name]}" — run skills/agent-creator/scripts/migrate-project.mjs (preview by default, --write to apply)`
      : ''
    throw new Error(`${label}: skill "${name}" is not installed in the project or in Agent Kit at ${toolkitRoot}${renamed}`)
  })
}

function expectedTargets(projectRoot, specs, profiles) {
  for (const profileName of new Set(specs.map((spec) => spec?.profile))) {
    const instances = specs.filter((spec) => spec?.profile === profileName)
    if (instances.length > 1 && (instances.some((spec) => !spec.description) || new Set(instances.map((spec) => spec.description)).size !== instances.length)) {
      throw new Error(`${profileName}: multiple project instances require distinct responsibility descriptions`)
    }
  }
  const targets = new Map()
  const names = new Set()
  for (const spec of specs) {
    const runtimes = validateSpec(spec, profiles, names)
    const profile = profiles.get(spec.profile)
    const agent = composeAgent(profile, spec)
    for (const id of runtimes) {
      const runtime = runtimeRegistry.get(id)
      const resolved = resolveSources(projectRoot, runtime.skillDirectories, agent.skills, spec.name)
      // Portable locators only (see skillLocator): host identifiers and
      // project-relative paths, resolved by each user's own installation. The
      // same recipe renders the same bytes on every machine.
      const sources = resolved.map((entry) => ({ name: entry.name, path: skillLocator(runtime, entry) }))
      const provenance = { inputs: compositionFingerprint(agent, id, sources) }
      const content = renderTarget(id, agent, sources, `.agent-kit/agents.json profile ${spec.profile}`, provenance)
      const leaks = portabilityIssues(content, runtime.parse(content), MACHINE_PATHS)
      if (leaks.length) throw new Error(`${spec.name} · ${id}: rendered target is not portable: ${leaks.join('; ')}`)
      const notes = [
        ...resolved.filter((entry) => entry.shadows).map((entry) => `project skill ${entry.name} shadows the Agent Kit skill of the same name`),
        ...resolved.filter((entry) => !entry.invocable).map((entry) => `skill ${entry.name} sets disable-model-invocation, so ${runtime.label} will not load it for this agent`),
      ]
      targets.set(runtime.targetPath(projectRoot, spec.name), { agent: spec.name, runtime, content, notes })
    }
  }
  return targets
}

function generatedFilesIn(projectRoot) {
  const files = []
  for (const runtime of runtimeRegistry.values()) {
    const dir = join(projectRoot, runtime.directory)
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isFile() && isGeneratedAgent(readFileSync(path, 'utf8'))) files.push(path)
    }
  }
  return files
}

function assess(path, target) {
  if (!existsSync(path)) return { kind: 'new', changes: ['new target'] }
  const current = readFileSync(path, 'utf8')
  if (current === target.content) return { kind: 'none', changes: [] }
  if (!isGeneratedAgent(current)) return { kind: 'collision', changes: ['user-owned file with the same name'] }
  let parsed
  try {
    parsed = target.runtime.parse(current)
  } catch {
    return { kind: 'semantic', changes: ['previous target could not be parsed; treat as a full refresh'] }
  }
  const result = compareTargets(parsed, target.runtime.parse(target.content))
  // The bytes differ even when the parsed composition does not.
  if (result.kind === 'none') result.kind = 'format'
  if (result.kind === 'format') result.changes.push('generated text differs without a composition change (renderer update or hand edit)')
  const leaks = portabilityIssues(current, parsed, MACHINE_PATHS)
  if (leaks.length) result.changes.unshift(...leaks.map((issue) => `not portable: ${issue}`))
  return result
}

function report(projectRoot, rows) {
  for (const { path, target, result } of rows) {
    console.log(`${target.agent} · ${target.runtime.id} · ${relative(projectRoot, path)}`)
    // Runtime limitations accompany a written or changed target, not every check.
    const limits = result.kind === 'none' ? [] : target.runtime.limitations ?? []
    for (const line of [...result.changes, ...[...target.notes, ...limits].map((note) => `note: ${note}`)]) console.log(`  - ${line}`)
  }
}

function run() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return
  }
  const profiles = loadProfiles(toolkitRoot)
  if (args.listProfiles) {
    for (const profile of profiles) console.log(`${profile.name}\t${profile.front.description}`)
    return
  }
  const profileMap = new Map(profiles.map((profile) => [profile.name, profile]))
  const config = readConfig(args.config)
  const all = expectedTargets(args.projectRoot, config.agents, profileMap)

  if (args.brief) {
    const spec = config.agents.find((entry) => entry.name === args.brief)
    if (!spec) throw new Error(`Project agent not configured: ${args.brief}`)
    const agent = composeAgent(profileMap.get(spec.profile), spec)
    const sources = resolveSources(args.projectRoot, runtimeRegistry.get('claude').skillDirectories, agent.skills, spec.name)
      // The brief is ephemeral output for this session, so library skills keep the
      // local path; it is never written to the project.
      .map((entry) => ({ name: entry.name, path: entry.project ? entry.relative : entry.absolute }))
    process.stdout.write(renderAgentBrief(agent, sources))
    return
  }

  if (args.agent && !config.agents.some((entry) => entry.name === args.agent)) {
    throw new Error(`Project agent not configured: ${args.agent}`)
  }
  const targets = new Map([...all].filter(([, target]) => !args.agent || target.agent === args.agent))
  const rows = [...targets].map(([path, target]) => ({ path, target, result: assess(path, target) }))
  const orphans = args.agent ? [] : generatedFilesIn(args.projectRoot).filter((path) => !all.has(path))
  const changed = rows.filter((row) => row.result.kind !== 'none' || row.target.notes.length)

  if (args.check || args.dryRun) {
    report(args.projectRoot, changed)
    for (const path of orphans) console.log(`orphan · ${relative(args.projectRoot, path)}\n  - generated target no longer configured; rerun with --prune`)
    if (!args.check) return
    // Targets are portable, so any difference is drift: --check passes exactly
    // when regenerating would write nothing.
    const stale = rows.filter((row) => row.result.kind !== 'none').length + orphans.length
    if (stale) {
      console.error(`Project agent targets are stale: ${stale} target(s). Refresh with materialize-agents.mjs${args.agent ? ` --agent ${args.agent}` : ''}.`)
      process.exit(1)
    }
    console.log(`Project agent targets up to date: ${targets.size} target(s), Agent Kit ${kitVersion(toolkitRoot)}.`)
    return
  }

  const collisions = rows.filter((row) => row.result.kind === 'collision')
  if (collisions.length) {
    throw new Error(`Refusing to overwrite non-generated agent(s): ${collisions.map((row) => row.path).join(', ')}`)
  }
  report(args.projectRoot, changed)
  for (const { path, target, result } of rows) {
    if (result.kind === 'none') continue
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, target.content)
  }
  if (args.prune) for (const path of orphans) unlinkSync(path)
  const written = rows.filter((row) => row.result.kind !== 'none').length
  const suffix = orphans.length && !args.prune ? ` ${orphans.length} generated orphan(s) left; rerun with --prune.` : ''
  console.log(`Materialized ${written} changed of ${targets.size} runtime file(s) for ${args.agent ?? `${config.agents.length} project agent(s)`}.${suffix}`)
}

try {
  run()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
