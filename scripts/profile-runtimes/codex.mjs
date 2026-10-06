import { basename, dirname, join } from 'node:path'
import {
  CORE_EFFORT,
  PLUGIN_NAME,
  choice,
  generatedComments,
  knowledgeInstructions,
  layered,
  modelName,
  readProvenance,
  splitKnowledge,
  validateFields,
} from './shared.mjs'

export const CODEX_EFFORT = [...CORE_EFFORT, 'ultra']
export const SANDBOX_BY_ACCESS = { 'read-only': 'read-only', edits: 'workspace-write', full: 'workspace-write' }
const SOURCES_INTRO = 'Load these selected knowledge skills when relevant before acting; load linked references only as needed. A skill name is listed in this session\'s skill catalog with its location (Agent Kit skills are `agent-kit:<skill>`): read that SKILL.md completely. A path is relative to the project root: read that file.'
const identity = (agent) => `You are the project custom agent "${agent.name}", materialized from the Agent Kit profession profile "${agent.profile}".\n\n`

export const codex = {
  id: 'codex',
  label: 'Codex',
  directory: '.codex/agents',
  extension: '.toml',
  skillDirectories: ['.agents/skills', 'skills'],
  // Codex lists `.agents/skills` from the project root down to the working directory.
  discoveredSkillDirectories: ['.agents/skills'],
  schema: {
    // Omitted model (or "inherit") inherits the parent thread's model.
    model: modelName,
    effort: choice(CODEX_EFFORT),
    sandbox_mode: choice(['read-only', 'workspace-write', 'danger-full-access']),
  },

  validate(overlay, origin) {
    validateFields(overlay, this.schema, origin)
  },

  resolve(profile, project, portable) {
    const settings = { ...profile, ...project }
    if (settings.model === null || settings.model === 'inherit') delete settings.model
    settings.effort = layered(profile, project, portable.effort, portable.effortOverride, 'effort')
    settings.sandbox_mode = layered(profile, project, SANDBOX_BY_ACCESS[portable.access], portable.accessOverride, 'sandbox_mode')
    return settings
  },

  targetPath(root, name) {
    return join(root, this.directory, `${name}${this.extension}`)
  },

  // Codex namespaces plugin skills by the plugin manifest name (`sample:search`).
  librarySkill(name) {
    return `${PLUGIN_NAME}:${name}`
  },

  // No `[[skills.config]]`: a role file may only disable skills (Codex 0.157+
  // keeps entries with enabled = false), so an enabling entry is dropped and its
  // path would only pin this machine. The child inherits the parent's skill
  // catalog; developer_instructions names each selected skill by its catalog
  // name (plugin skills are `agent-kit:<skill>`) or project-relative path.
  render(agent, sources, source, provenance) {
    const settings = agent.codex
    const instructions = `${identity(agent)}${agent.body.trimEnd()}${knowledgeInstructions(sources, SOURCES_INTRO)}\n`
    const lines = [generatedComments(source, provenance), `name = ${JSON.stringify(agent.name)}`, `description = ${JSON.stringify(agent.description)}`]
    if (settings.model) lines.push(`model = ${JSON.stringify(settings.model)}`)
    lines.push(
      `model_reasoning_effort = ${JSON.stringify(settings.effort)}`,
      `sandbox_mode = ${JSON.stringify(settings.sandbox_mode)}`,
      `developer_instructions = ${JSON.stringify(instructions)}`,
    )
    return `${lines.join('\n')}\n`
  },

  parse(content) {
    const top = {}
    const paths = []
    let section = 'top'
    for (const line of content.split('\n')) {
      if (line.startsWith('[[')) section = line
      const match = /^([a-z_]+) = (.*)$/.exec(line)
      if (!match) continue
      const value = JSON.parse(match[2])
      if (section === 'top') top[match[1]] = value
      else if (section === '[[skills.config]]' && match[1] === 'path') paths.push(value)
    }
    const prefix = /^You are the project custom agent "[^"]*", materialized from the Agent Kit profession profile "[^"]*"\.\n\n/
    const knowledge = splitKnowledge((top.developer_instructions ?? '').replace(prefix, ''))
    // Targets before 4.0.0-rc.2 also listed each skill as a `[[skills.config]]` path.
    const legacy = paths.map((path) => basename(path === 'SKILL.md' || path.endsWith('/SKILL.md') ? dirname(path) : path))
    const sources = { ...Object.fromEntries(legacy.map((skill, index) => [skill, paths[index]])), ...knowledge.sources }
    const skills = [...new Set([...legacy, ...Object.keys(knowledge.sources)])]
    const settings = { effort: top.model_reasoning_effort, sandbox_mode: top.sandbox_mode }
    if (top.model !== undefined) settings.model = top.model
    const locators = [...legacy.map((skill, index) => [skill, paths[index]]), ...Object.entries(knowledge.sources)]
    return { name: top.name, description: top.description, skills, settings, body: knowledge.body, sources, locators, provenance: readProvenance(content) }
  },
}
