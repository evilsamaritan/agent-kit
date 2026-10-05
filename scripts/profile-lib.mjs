import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFlatYaml, splitFrontmatter } from './profile-format.mjs'
import { DEFAULT_RUNTIMES, RUNTIMES, runtimeRegistry } from './profile-runtimes/index.mjs'
import { ACCESS, CORE_EFFORT, isGeneratedAgent } from './profile-runtimes/shared.mjs'

export { ACCESS, CORE_EFFORT, DEFAULT_RUNTIMES, RUNTIMES, isGeneratedAgent, runtimeRegistry }

const CORE_FIELDS = new Set(['name', 'description', 'role', 'skills', 'effort', 'access'])
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function kitVersion(toolkitRoot) {
  const header = readFileSync(join(toolkitRoot, 'AGENTS.md'), 'utf8').split('\n', 1)[0]
  const match = /^# agent-kit v(\S+)$/.exec(header)
  if (!match) throw new Error('AGENTS.md version header missing')
  return match[1]
}

function validateCore(name, front, body, knownRoles, knownSkills, issues) {
  for (const key of Object.keys(front)) {
    if (!CORE_FIELDS.has(key)) issues.push(`${name}: core field "${key}" is not supported`)
  }
  if (front.name !== name) issues.push(`${name}: core name "${front.name}" does not match directory`)
  if (!NAME_PATTERN.test(name)) issues.push(`${name}: profile name must be lowercase kebab-case`)
  if (typeof front.description !== 'string' || !front.description) issues.push(`${name}: core description is required`)
  if (!body.trim()) issues.push(`${name}: PROFILE.md has an empty body`)
  if (!CORE_EFFORT.includes(front.effort)) issues.push(`${name}: core effort must be one of ${CORE_EFFORT.join(', ')}`)
  if (!ACCESS.includes(front.access)) issues.push(`${name}: core access must be one of ${ACCESS.join(', ')}`)

  if (!Array.isArray(front.skills)) issues.push(`${name}: core skills must be an inline array`)
  for (const skill of Array.isArray(front.skills) ? front.skills : []) {
    if (!knownSkills.has(skill)) issues.push(`${name}: default skill "${skill}" does not exist in skills/`)
  }

  const roles = Array.isArray(front.role) ? front.role : []
  if (!roles.length) issues.push(`${name}: role must be a non-empty inline array`)
  for (const role of roles) {
    if (!knownRoles.has(role)) issues.push(`${name}: role "${role}" has no template in skills/agent-creator/templates/`)
    else if (!new RegExp(`^## Role — ${escapeRegex(role)}\\s*$`, 'm').test(body)) {
      issues.push(`${name}: body has no exact "## Role — ${role}" section`)
    }
  }
  for (const match of body.matchAll(/^## Role — ([a-z-]+)\s*$/gm)) {
    if (!roles.includes(match[1])) issues.push(`${name}: body declares undeclared role section "${match[1]}"`)
  }
}

export function loadProfiles(toolkitRoot) {
  const issues = []
  const profilesDir = join(toolkitRoot, 'profiles')
  if (!existsSync(profilesDir)) throw new Error(`Profile library not found: ${profilesDir}`)
  const knownRoles = new Set(
    readdirSync(join(toolkitRoot, 'skills', 'agent-creator', 'templates'))
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => entry.slice(0, -3)),
  )
  const knownSkills = new Set(
    readdirSync(join(toolkitRoot, 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  )

  const profiles = readdirSync(profilesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const dir = join(profilesDir, name)
      const profilePath = join(dir, 'PROFILE.md')
      if (!existsSync(profilePath)) {
        issues.push(`${name}: directory has no PROFILE.md`)
        return null
      }
      const { front, body } = splitFrontmatter(readFileSync(profilePath, 'utf8'), `profiles/${name}/PROFILE.md`, issues)
      validateCore(name, front, body, knownRoles, knownSkills, issues)
      const profile = { name, front, body, dir }
      for (const runtime of runtimeRegistry.values()) {
        const file = join(dir, `${runtime.id}.yaml`)
        const origin = `profiles/${name}/${runtime.id}.yaml`
        profile[runtime.id] = existsSync(file) ? parseFlatYaml(readFileSync(file, 'utf8'), origin, issues) : {}
        try {
          runtime.validate(profile[runtime.id], origin)
        } catch (error) {
          issues.push(error.message)
        }
      }
      return profile
    })
    .filter(Boolean)

  if (issues.length > 0) throw new Error(`Profile validation failed:\n  ${issues.join('\n  ')}`)
  return profiles
}

// Layers: profile core → profile runtime overlay → portable project overrides →
// explicit project runtime overrides. Resolve once; renderers only format.
export function composeAgent(profile, spec = {}) {
  const portable = {
    access: spec.access ?? profile.front.access,
    accessOverride: spec.access !== undefined,
    effort: spec.effort ?? profile.front.effort,
    effortOverride: spec.effort !== undefined,
  }
  const agent = {
    profile: profile.name,
    name: spec.name ?? profile.name,
    description: spec.description ?? profile.front.description,
    roles: [...(profile.front.role ?? [])],
    skills: spec.skills === undefined ? [...(profile.front.skills ?? [])] : [...spec.skills],
    effort: portable.effort,
    access: portable.access,
    body: profile.body,
  }
  for (const runtime of runtimeRegistry.values()) {
    agent[runtime.id] = runtime.resolve(profile[runtime.id] ?? {}, spec[runtime.id] ?? {}, portable)
  }
  return agent
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

// Fingerprint of the inputs a target was built from, independent of machine paths.
export function inputFingerprint(profile, spec, runtimeId) {
  const inputs = { front: profile.front, body: profile.body, overlay: profile[runtimeId] ?? {}, spec, runtime: runtimeId }
  return createHash('sha256').update(stable(inputs)).digest('hex').slice(0, 16)
}

export function renderTarget(runtimeId, agent, sources = [], source = `profile ${agent.profile}`, provenance) {
  const runtime = runtimeRegistry.get(runtimeId)
  if (!runtime) throw new Error(`Unknown runtime "${runtimeId}"`)
  return runtime.render(agent, sources, source, provenance)
}

export function renderAgentBrief(agent, sources = []) {
  const byName = new Map(sources.map((entry) => [entry.name, entry.path]))
  const list = agent.skills.map((skill) => `- ${skill}${byName.has(skill) ? `: ${JSON.stringify(byName.get(skill))}` : ''}`).join('\n')
  return `# ${agent.name}\n\nResponsibility: ${agent.description}\nProfile: ${agent.profile}\n\n${agent.body.trimEnd()}\n\n## Selected knowledge\n\nLoad relevant bodies from these selected sources and deeper references only as needed:\n\n${list || 'No default knowledge selected.'}\n\nThe caller supplies the bounded task, file ownership, inputs, deliverable, and required evidence. This brief conveys behavior and knowledge; it does not enforce native tool, sandbox, model, effort, or preload settings absent from the host API.\n`
}

export function renderProfileReference(profile) {
  const agent = composeAgent(profile)
  return `# ${profile.name}\n\n<!-- Generated by agent-kit from profiles/${profile.name}/. Do not edit by hand. -->\n\n## Defaults\n\n- Roles: ${agent.roles.join(', ')}\n- Skills: ${agent.skills.length ? agent.skills.join(', ') : 'none'}\n- Effort / access: ${agent.effort} / ${agent.access}\n- Claude model / tools: ${agent.claude.model ?? 'inherit'} / ${agent.claude.tools.join(', ')}\n- Codex model / effort / sandbox: ${agent.codex.model ?? 'inherit'} / ${agent.codex.effort} / ${agent.codex.sandbox_mode}\n- Kimi tools: ${agent.kimi.tools.join(', ')}\n\n## Persona\n\n${agent.body.trimEnd()}\n`
}

export function renderProfileCatalog(profiles) {
  const rows = profiles
    .map((profile) => {
      const skills = profile.front.skills?.length ? profile.front.skills.join(', ') : 'none'
      return `| \`${profile.name}\` | ${profile.front.role.join(' + ')} | ${skills} | ${profile.front.description} |`
    })
    .join('\n')
  return `# Profession Profile Catalog\n\n<!-- Generated by agent-kit from profiles/. Do not edit by hand. -->\n\nProfiles are reusable profession defaults. Project agents may keep the defaults or replace the skill set through \`.agent-kit/agents.json\`.\n\n| Profile | Roles | Default skills | Use when |\n|---------|-------|----------------|----------|\n${rows}\n`
}
