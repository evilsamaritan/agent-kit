import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFlatYaml, splitFrontmatter } from './profile-format.mjs'
import { DEFAULT_RUNTIMES, RUNTIMES, runtimeRegistry } from './profile-runtimes/index.mjs'
import { ACCESS, CORE_EFFORT, RESERVED_HEADINGS, isGeneratedAgent } from './profile-runtimes/shared.mjs'

export { ACCESS, CORE_EFFORT, DEFAULT_RUNTIMES, RUNTIMES, isGeneratedAgent, runtimeRegistry }

// Project instructions are one text in agents.json: a string, or an array of
// strings joined by newlines so JSON stays readable. Headings the renderer owns
// are reserved, because the diff parser splits the rendered body on them.
export function normalizeInstructions(value, label) {
  if (value === undefined) return undefined
  const parts = Array.isArray(value) ? value : [value]
  if (!parts.length || parts.some((part) => typeof part !== 'string')) {
    throw new Error(`${label}: instructions must be a non-empty string or an array of strings`)
  }
  const text = parts.join('\n').trim()
  if (!text) throw new Error(`${label}: instructions must not be empty`)
  for (const heading of RESERVED_HEADINGS) {
    if (new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(text)) {
      throw new Error(`${label}: instructions must not contain the heading "${heading}"; the generated target owns it`)
    }
  }
  return text
}

const CORE_FIELDS = new Set(['name', 'description', 'role', 'skills', 'requires', 'effort', 'access'])
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
  if (front.requires !== undefined) {
    if (!Array.isArray(front.requires)) issues.push(`${name}: core requires must be an inline array`)
    for (const skill of Array.isArray(front.requires) ? front.requires : []) {
      if (!Array.isArray(front.skills) || !front.skills.includes(skill)) {
        issues.push(`${name}: required skill "${skill}" must also be a default skill`)
      }
    }
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

// Required skills come first and cannot be removed by a project; the project's
// exact list (or the profile defaults) follows without duplicates.
export function composeSkills(profile, spec = {}) {
  const required = profile.front.requires ?? []
  const selected = spec.skills === undefined ? profile.front.skills ?? [] : spec.skills
  return [...new Set([...required, ...selected])]
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
    skills: composeSkills(profile, spec),
    effort: portable.effort,
    access: portable.access,
    body: profile.body,
    instructions: normalizeInstructions(spec.instructions, spec.name ?? profile.name),
    delegationHint: spec.delegation_hint !== false,
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

// Fingerprint of the resolved composition one target renders: identity, body,
// exact skills, that runtime's settings, and the source locators. It changes
// only when the composition does, so a kit upgrade that leaves an agent
// unchanged leaves its file unchanged. Kit version and machine paths
// are not inputs.
export function compositionFingerprint(agent, runtimeId, sources = []) {
  const inputs = {
    runtime: runtimeId,
    name: agent.name,
    profile: agent.profile,
    description: agent.description,
    body: agent.body,
    skills: agent.skills,
    settings: agent[runtimeId] ?? {},
    sources: sources.map(({ name, path }) => [name, path]),
  }
  // Added only when set, so agents without them keep their 4.0 fingerprints.
  if (agent.instructions) inputs.instructions = agent.instructions
  if (agent.delegationHint === false) inputs.delegationHint = false
  return createHash('sha256').update(stable(inputs)).digest('hex').slice(0, 16)
}

// Without resolved sources, every selected skill is taken from the library.
export function renderTarget(runtimeId, agent, sources, source = `profile ${agent.profile}`, provenance) {
  const runtime = runtimeRegistry.get(runtimeId)
  if (!runtime) throw new Error(`Unknown runtime "${runtimeId}"`)
  const resolved = sources ?? agent.skills.map((name) => ({ name, path: runtime.librarySkill(name) }))
  return runtime.render(agent, resolved, source, provenance)
}

export function renderAgentBrief(agent, sources = []) {
  const byName = new Map(sources.map((entry) => [entry.name, entry.path]))
  const list = agent.skills.map((skill) => `- ${skill}${byName.has(skill) ? `: ${JSON.stringify(byName.get(skill))}` : ''}`).join('\n')
  const instructions = agent.instructions ? `\n\n## Project instructions\n\n${agent.instructions.trim()}` : ''
  return `# ${agent.name}\n\nResponsibility: ${agent.description}\nProfile: ${agent.profile}\n\n${agent.body.trimEnd()}${instructions}\n\n## Selected knowledge\n\nLoad relevant bodies from these selected sources and deeper references only as needed:\n\n${list || 'No default knowledge selected.'}\n\nThe caller supplies the bounded task, file ownership, inputs, deliverable, and required evidence. This brief conveys behavior and knowledge; it does not enforce native tool, sandbox, model, effort, or preload settings absent from the host API.\n`
}

export function renderProfileReference(profile) {
  const agent = composeAgent(profile)
  return `# ${profile.name}\n\n<!-- Generated by agent-kit from profiles/${profile.name}/. Do not edit by hand. -->\n\n## Defaults\n\n- Roles: ${agent.roles.join(', ')}\n- Skills: ${agent.skills.length ? agent.skills.join(', ') : 'none'}\n- Required skills: ${profile.front.requires?.length ? profile.front.requires.join(', ') : 'none'}\n- Effort / access: ${agent.effort} / ${agent.access}\n- Claude model / tools: ${agent.claude.model ?? 'inherit'} / ${agent.claude.tools.join(', ')}\n- Codex model / effort / sandbox: ${agent.codex.model ?? 'inherit'} / ${agent.codex.effort} / ${agent.codex.sandbox_mode}\n- Kimi tools: ${agent.kimi.tools.join(', ')}\n\n## Persona\n\n${agent.body.trimEnd()}\n`
}

export function renderProfileCatalog(profiles) {
  const rows = profiles
    .map((profile) => {
      const skills = profile.front.skills?.length ? profile.front.skills.join(', ') : 'none'
      const required = profile.front.requires?.length ? profile.front.requires.join(', ') : '—'
      return `| \`${profile.name}\` | ${profile.front.role.join(' + ')} | ${skills} | ${required} | ${profile.front.description} |`
    })
    .join('\n')
  return `# Profession Profile Catalog\n\n<!-- Generated by agent-kit from profiles/. Do not edit by hand. -->\n\nProfiles are reusable profession defaults. Project agents may keep the defaults or replace the skill set through \`.agent-kit/agents.json\`; required skills are always included.\n\n| Profile | Roles | Default skills | Required | Use when |\n|---------|-------|----------------|----------|----------|\n${rows}\n`
}
