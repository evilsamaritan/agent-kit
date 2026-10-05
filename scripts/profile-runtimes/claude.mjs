import { join } from 'node:path'
import { splitFrontmatter } from '../profile-format.mjs'
import {
  CORE_EFFORT,
  boolean,
  choice,
  generatedComments,
  knowledgeInstructions,
  layered,
  modelName,
  positiveInteger,
  readProvenance,
  splitKnowledge,
  stringList,
  stripGeneratedComments,
  validateFields,
  yamlList,
} from './shared.mjs'

export const CLAUDE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']
export const TOOLS_BY_ACCESS = {
  'read-only': ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Skill'],
  edits: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Skill'],
  full: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Bash', 'Skill'],
}
const RENDERED = ['model', 'color', 'maxTurns', 'memory', 'background', 'isolation']

export const claude = {
  id: 'claude',
  label: 'Claude Code',
  directory: '.claude/agents',
  extension: '.md',
  // Project-local skill roots, searched before the installed Agent Kit library.
  skillDirectories: ['.claude/skills', '.agents/skills', 'skills'],
  schema: {
    // Omitted model inherits the parent session (or CLAUDE_CODE_SUBAGENT_MODEL);
    // aliases such as opus/sonnet, full model IDs, and "inherit" are explicit choices.
    model: modelName,
    effort: choice(CORE_EFFORT),
    color: choice(CLAUDE_COLORS),
    tools: stringList,
    disallowedTools: stringList,
    maxTurns: positiveInteger,
    memory: choice(['user', 'project', 'local']),
    background: boolean,
    isolation: choice(['worktree']),
  },

  validate(overlay, origin) {
    validateFields(overlay, this.schema, origin)
  },

  resolve(profile, project, portable) {
    const settings = { ...profile, ...project }
    if (settings.model === null) delete settings.model
    settings.effort = layered(profile, project, portable.effort, portable.effortOverride, 'effort')
    const tools = layered(profile, project, TOOLS_BY_ACCESS[portable.access], portable.accessOverride, 'tools')
    const denied = new Set((settings.disallowedTools ?? []).map((entry) => entry.split('(')[0]))
    settings.tools = tools.filter((tool) => !denied.has(tool))
    // Claude memory grants Read/Write/Edit on its memory directory.
    if (settings.memory && portable.access === 'read-only' && project.tools === undefined) {
      throw new Error('Claude memory enables Write/Edit and cannot keep read-only access. Remove memory or set claude.tools explicitly.')
    }
    return settings
  },

  targetPath(root, name) {
    return join(root, this.directory, `${name}${this.extension}`)
  },

  // Bare `skills:` keeps the native preload hint; the body also lists the resolved
  // sources because a project agent's bare name is not guaranteed to resolve to a
  // plugin skill.
  render(agent, sources, source, provenance) {
    const settings = agent.claude
    const lines = ['---', `name: ${agent.name}`, `description: ${JSON.stringify(agent.description)}`, `effort: ${settings.effort}`]
    for (const key of RENDERED) {
      if (settings[key] !== undefined) lines.push(`${key}: ${JSON.stringify(settings[key])}`)
    }
    if (agent.skills.length) lines.push(`skills: ${yamlList(agent.skills)}`)
    lines.push(`tools: ${yamlList(settings.tools)}`)
    if (settings.disallowedTools?.length) lines.push(`disallowedTools: ${yamlList(settings.disallowedTools)}`)
    lines.push('---', '', generatedComments(source, provenance, true), '')
    return `${lines.join('\n')}${agent.body.trimEnd()}${knowledgeInstructions(sources)}\n`
  },

  parse(content) {
    const issues = []
    const { front, body } = splitFrontmatter(content, 'target', issues)
    const { name, description, skills = [], ...settings } = front
    const knowledge = splitKnowledge(stripGeneratedComments(body))
    return { name, description, skills, settings, body: knowledge.body, sources: knowledge.sources, provenance: readProvenance(content) }
  },
}
