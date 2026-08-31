import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

export const CORE_EFFORT = ['low', 'medium', 'high', 'xhigh', 'max']
export const CODEX_EFFORT = [...CORE_EFFORT, 'ultra']
export const CLAUDE_MODELS = ['opus', 'sonnet', 'haiku', 'fable', 'inherit']
export const CLAUDE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']
export const CODEX_MODELS = [
  'gpt-5.6',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
]
export const ACCESS = ['read-only', 'edits', 'full']
export const RUNTIMES = ['claude', 'codex']

const CORE_FIELDS = new Set(['name', 'description', 'role', 'skills', 'effort', 'access'])
const CLAUDE_FIELDS = new Set([
  'model',
  'color',
  'tools',
  'disallowedTools',
  'maxTurns',
  'memory',
  'background',
  'isolation',
])
const CODEX_FIELDS = new Set(['model', 'effort'])

export const TOOLS_BY_ACCESS = {
  'read-only': ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Skill'],
  edits: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Skill'],
  full: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Bash', 'Skill'],
}

export const SANDBOX_BY_ACCESS = {
  'read-only': 'read-only',
  edits: 'workspace-write',
  full: 'workspace-write',
}

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function parseFlatYaml(text, origin, issues) {
  const out = {}
  text.split('\n').forEach((rawLine, index) => {
    const line = rawLine.replace(/\s+$/, '')
    if (!line || line.trimStart().startsWith('#')) return
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (!match) {
      issues.push(`${origin}:${index + 1}: not a flat "key: value" line`)
      return
    }
    const [, key, raw] = match
    if (raw === '' || raw === '|' || raw === '>') {
      issues.push(`${origin}:${index + 1}: "${key}" must be a single-line scalar or inline array`)
      return
    }
    if (raw.startsWith('[')) {
      if (!raw.endsWith(']')) {
        issues.push(`${origin}:${index + 1}: unterminated inline array for "${key}"`)
        return
      }
      out[key] = raw
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
      return
    }
    out[key] = raw.replace(/^["']|["']$/g, '')
  })
  return out
}

function splitFrontmatter(text, origin, issues) {
  if (!text.startsWith('---\n')) {
    issues.push(`${origin}: missing opening frontmatter delimiter`)
    return { front: {}, body: '' }
  }
  const end = text.indexOf('\n---', 3)
  if (end === -1) {
    issues.push(`${origin}: missing closing frontmatter delimiter`)
    return { front: {}, body: '' }
  }
  const front = parseFlatYaml(text.slice(4, end + 1), origin, issues)
  const body = text.slice(text.indexOf('\n', end + 1) + 1).replace(/^\n+/, '')
  return { front, body }
}

function readOverlay(dir, file, issues) {
  const path = join(dir, file)
  if (!existsSync(path)) return {}
  return parseFlatYaml(readFileSync(path, 'utf8'), `profiles/${basename(dir)}/${file}`, issues)
}

function rejectUnknownFields(profile, values, allowed, layer, issues) {
  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) issues.push(`${profile}: ${layer} field "${key}" is not supported`)
  }
}

export function loadProfiles(toolkitRoot) {
  const issues = []
  const profilesDir = join(toolkitRoot, 'profiles')
  const templatesDir = join(toolkitRoot, 'skills', 'agent-creator', 'templates')
  const skillsDir = join(toolkitRoot, 'skills')

  if (!existsSync(profilesDir)) throw new Error(`Profile library not found: ${profilesDir}`)

  const knownRoles = new Set(
    readdirSync(templatesDir)
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => entry.slice(0, -3)),
  )
  const knownSkills = new Set(
    readdirSync(skillsDir, { withFileTypes: true })
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

      const { front, body } = splitFrontmatter(
        readFileSync(profilePath, 'utf8'),
        `profiles/${name}/PROFILE.md`,
        issues,
      )
      const claude = readOverlay(dir, 'claude.yaml', issues)
      const codex = readOverlay(dir, 'codex.yaml', issues)

      rejectUnknownFields(name, front, CORE_FIELDS, 'core', issues)
      rejectUnknownFields(name, claude, CLAUDE_FIELDS, 'claude.yaml', issues)
      rejectUnknownFields(name, codex, CODEX_FIELDS, 'codex.yaml', issues)

      if (front.name !== name) issues.push(`${name}: core name "${front.name}" does not match directory`)
      if (!NAME_PATTERN.test(name)) issues.push(`${name}: profile name must be lowercase kebab-case`)
      if (!front.description) issues.push(`${name}: core description is required`)
      if (!body.trim()) issues.push(`${name}: PROFILE.md has an empty body`)

      if (!front.effort) issues.push(`${name}: core effort is required`)
      else if (!CORE_EFFORT.includes(front.effort)) {
        issues.push(`${name}: core effort "${front.effort}" is not one of ${CORE_EFFORT.join(', ')}`)
      }

      if (!front.access) issues.push(`${name}: core access is required`)
      else if (!ACCESS.includes(front.access)) {
        issues.push(`${name}: access "${front.access}" is not one of ${ACCESS.join(', ')}`)
      }

      if (!Array.isArray(front.skills)) issues.push(`${name}: core skills must be an inline array`)
      for (const skill of Array.isArray(front.skills) ? front.skills : []) {
        if (!knownSkills.has(skill)) issues.push(`${name}: default skill "${skill}" does not exist in skills/`)
      }

      if (!Array.isArray(front.role) || !front.role.length) issues.push(`${name}: role must be a non-empty inline array`)
      for (const role of Array.isArray(front.role) ? front.role : []) {
        if (!knownRoles.has(role)) {
          issues.push(`${name}: role "${role}" has no template in skills/agent-creator/templates/`)
        } else if (!new RegExp(`^## Role — ${escapeRegex(role)}\\s*$`, 'm').test(body)) {
          issues.push(`${name}: body has no exact "## Role — ${role}" section`)
        }
      }
      const bodyRoles = [...body.matchAll(/^## Role — ([a-z-]+)\s*$/gm)].map((match) => match[1])
      for (const role of bodyRoles) {
        if (!(Array.isArray(front.role) ? front.role : []).includes(role)) {
          issues.push(`${name}: body declares undeclared role section "${role}"`)
        }
      }

      if (claude.model && !CLAUDE_MODELS.includes(claude.model)) {
        issues.push(`${name}: claude.yaml model "${claude.model}" is not one of ${CLAUDE_MODELS.join(', ')}`)
      }
      if (claude.color && !CLAUDE_COLORS.includes(claude.color)) {
        issues.push(`${name}: claude.yaml color "${claude.color}" is not supported`)
      }
      if (claude.tools !== undefined && !Array.isArray(claude.tools)) {
        issues.push(`${name}: claude.yaml tools must be an inline array`)
      }
      if (claude.disallowedTools !== undefined && !Array.isArray(claude.disallowedTools)) {
        issues.push(`${name}: claude.yaml disallowedTools must be an inline array`)
      }
      if (claude.maxTurns !== undefined && !/^[1-9]\d*$/.test(claude.maxTurns)) {
        issues.push(`${name}: claude.yaml maxTurns must be a positive integer`)
      }
      if (claude.memory !== undefined && !['user', 'project', 'local'].includes(claude.memory)) {
        issues.push(`${name}: claude.yaml memory must be user, project, or local`)
      }
      if (claude.background !== undefined && !['true', 'false'].includes(claude.background)) {
        issues.push(`${name}: claude.yaml background must be true or false`)
      }
      if (claude.isolation !== undefined && claude.isolation !== 'worktree') {
        issues.push(`${name}: claude.yaml isolation must be worktree`)
      }
      if (codex.model && !CODEX_MODELS.includes(codex.model)) {
        issues.push(`${name}: codex.yaml model "${codex.model}" is not one of ${CODEX_MODELS.join(', ')}`)
      }
      if (codex.effort && !CODEX_EFFORT.includes(codex.effort)) {
        issues.push(`${name}: codex.yaml effort "${codex.effort}" is not a Codex reasoning level`)
      }

      return { name, front, body, claude, codex, dir }
    })
    .filter(Boolean)

  if (issues.length > 0) throw new Error(`Profile validation failed:\n  ${issues.join('\n  ')}`)
  return profiles
}

export function composeAgent(profile, spec = {}) {
  return {
    profile: profile.name,
    name: spec.name ?? profile.name,
    description: spec.description ?? profile.front.description,
    roles: [...(profile.front.role ?? [])],
    skills: spec.skills === undefined ? [...(profile.front.skills ?? [])] : [...spec.skills],
    effort: spec.effort ?? profile.front.effort,
    access: spec.access ?? profile.front.access,
    body: profile.body,
    claude: { ...profile.claude, ...(spec.claude ?? {}) },
    codex: { ...profile.codex, ...(spec.codex ?? {}) },
  }
}

const yamlList = (items) => `[${items.map((item) => JSON.stringify(item)).join(', ')}]`
const GENERATED_MARKER = 'Generated by agent-kit'

export function isGeneratedAgent(content) {
  return content
    .split('\n')
    .slice(0, 20)
    .some((line) =>
      /^# Generated by agent-kit from .+\. Do not edit by hand\.$/.test(line)
      || /^<!-- Generated by agent-kit from .+\. Do not edit by hand\. -->$/.test(line),
    )
}

export function renderClaudeAgent(agent, source = `profile ${agent.profile}`) {
  const tools = agent.claude.tools ?? TOOLS_BY_ACCESS[agent.access] ?? TOOLS_BY_ACCESS.edits
  const lines = [
    '---',
    `name: ${agent.name}`,
    `description: ${JSON.stringify(agent.description)}`,
    `effort: ${agent.effort}`,
  ]
  for (const field of ['model', 'color', 'maxTurns', 'memory', 'background', 'isolation']) {
    if (agent.claude[field] !== undefined) lines.push(`${field}: ${agent.claude[field]}`)
  }
  if (agent.skills.length) lines.push(`skills: ${yamlList(agent.skills)}`)
  lines.push(`tools: ${yamlList(tools)}`)
  if (agent.claude.disallowedTools) {
    const value = Array.isArray(agent.claude.disallowedTools)
      ? yamlList(agent.claude.disallowedTools)
      : agent.claude.disallowedTools
    lines.push(`disallowedTools: ${value}`)
  }
  lines.push('---', '', `<!-- ${GENERATED_MARKER} from ${source}. Do not edit by hand. -->`, '')
  return `${lines.join('\n')}${agent.body.trimEnd()}\n`
}

export function renderCodexAgent(agent, skillPaths = [], source = `profile ${agent.profile}`) {
  const model = agent.codex.model
  const effort = agent.codex.effort ?? agent.effort
  const sandbox = SANDBOX_BY_ACCESS[agent.access]
  const skillInstruction = agent.skills.length
    ? `\n\nBefore acting, read and follow these installed knowledge skills when relevant: ${agent.skills.join(', ')}.`
    : ''
  const identity = `You are the project custom agent "${agent.name}", materialized from the Agent Kit profession profile "${agent.profile}".\n\n`
  const instructions = `${identity}${agent.body.trimEnd()}${skillInstruction}\n`
  const lines = [
    `# ${GENERATED_MARKER} from ${source}. Do not edit by hand.`,
    `name = ${JSON.stringify(agent.name)}`,
    `description = ${JSON.stringify(agent.description)}`,
  ]
  if (model) lines.push(`model = ${JSON.stringify(model)}`)
  lines.push(
    `model_reasoning_effort = ${JSON.stringify(effort)}`,
    `sandbox_mode = ${JSON.stringify(sandbox)}`,
    `developer_instructions = ${JSON.stringify(instructions)}`,
  )
  for (const path of skillPaths) {
    lines.push('', '[[skills.config]]', `path = ${JSON.stringify(path)}`, 'enabled = true')
  }
  return `${lines.join('\n')}\n`
}

export function renderProfileReference(profile) {
  const agent = composeAgent(profile)
  return `# ${profile.name}\n\n<!-- ${GENERATED_MARKER} from profiles/${profile.name}/. Do not edit by hand. -->\n\n## Defaults\n\n- Roles: ${agent.roles.join(', ')}\n- Skills: ${agent.skills.length ? agent.skills.join(', ') : 'none'}\n- Effort / access: ${agent.effort} / ${agent.access}\n- Claude model: ${agent.claude.model ?? 'inherit'}\n- Codex model / effort: ${agent.codex.model ?? 'inherit'} / ${agent.codex.effort ?? agent.effort}\n\n## Persona\n\n${agent.body.trimEnd()}\n`
}

export function renderProfileCatalog(profiles) {
  const rows = profiles
    .map((profile) => {
      const skills = profile.front.skills?.length ? profile.front.skills.join(', ') : 'none'
      return `| \`${profile.name}\` | ${profile.front.role.join(' + ')} | ${skills} | ${profile.front.description} |`
    })
    .join('\n')
  return `# Profession Profile Catalog\n\n<!-- ${GENERATED_MARKER} from profiles/. Do not edit by hand. -->\n\nProfiles are reusable profession defaults. Project agents may keep the defaults or replace the skill set through \`.agent-kit/agents.json\`.\n\n| Profile | Roles | Default skills | Use when |\n|---------|-------|----------------|----------|\n${rows}\n`
}
