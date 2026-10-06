import { join } from 'node:path'
import { splitFrontmatter } from '../profile-format.mjs'
import {
  CORE_EFFORT,
  PLUGIN_NAME,
  boolean,
  choice,
  generatedComments,
  isSkillPath,
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
const SOURCES_INTRO = 'Load these selected knowledge skills when relevant before acting; load linked references only as needed. A skill id is preloaded through `skills:` or invoked with the Skill tool by that exact id (Agent Kit skills are `agent-kit:<skill>`, so a same-named skill elsewhere cannot replace them). A path is relative to the project root: read that file.'
const QUALIFIED = new RegExp(`^${PLUGIN_NAME}:`)

export const claude = {
  id: 'claude',
  label: 'Claude Code',
  directory: '.claude/agents',
  extension: '.md',
  // Project-local skill roots, searched before the installed Agent Kit library.
  skillDirectories: ['.claude/skills', '.agents/skills', 'skills'],
  // Roots Claude Code lists by skill name; other project skills are read by path.
  discoveredSkillDirectories: ['.claude/skills'],
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

  // Claude Code exposes plugin skills as `<plugin>:<skill>` and resolves an agent's
  // `skills:` entry by exact name first. A bare name falls back to the first alias
  // or `:<name>` suffix match, which can pick another plugin's skill.
  librarySkill(name) {
    return `${PLUGIN_NAME}:${name}`
  },

  // `skills:` preloads every selected skill Claude can resolve by id; a project
  // skill outside .claude/skills has no id and is listed by path in the body.
  render(agent, sources, source, provenance) {
    const settings = agent.claude
    const lines = ['---', `name: ${agent.name}`, `description: ${JSON.stringify(agent.description)}`, `effort: ${settings.effort}`]
    for (const key of RENDERED) {
      if (settings[key] !== undefined) lines.push(`${key}: ${JSON.stringify(settings[key])}`)
    }
    const preload = sources.map(({ path }) => path).filter((path) => !isSkillPath(path))
    if (preload.length) lines.push(`skills: ${yamlList(preload)}`)
    lines.push(`tools: ${yamlList(settings.tools)}`)
    if (settings.disallowedTools?.length) lines.push(`disallowedTools: ${yamlList(settings.disallowedTools)}`)
    lines.push('---', '', generatedComments(source, provenance, true), '')
    return `${lines.join('\n')}${agent.body.trimEnd()}${knowledgeInstructions(sources, SOURCES_INTRO)}\n`
  },

  parse(content) {
    const issues = []
    const { front, body } = splitFrontmatter(content, 'target', issues)
    const { name, description, skills: preload = [], ...settings } = front
    const knowledge = splitKnowledge(stripGeneratedComments(body))
    // Diffs speak in portable skill names: the source list is complete, while
    // `skills:` holds qualified ids and omits path-only project skills.
    const listed = Object.keys(knowledge.sources)
    const skills = listed.length ? listed : preload.map((skill) => skill.replace(QUALIFIED, ''))
    return { name, description, skills, settings, body: knowledge.body, sources: knowledge.sources, provenance: readProvenance(content) }
  },
}
