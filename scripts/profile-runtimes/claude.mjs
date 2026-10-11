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
  projectInstructions,
  readProvenance,
  splitKnowledge,
  stringList,
  stripGeneratedComments,
  validateFields,
  yamlList,
  delegationDescription,
} from './shared.mjs'

const CLAUDE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']
const TOOLS_BY_ACCESS = {
  'read-only': ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Skill'],
  edits: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Skill'],
  full: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Bash', 'Skill'],
}
const RENDERED = ['model', 'color', 'maxTurns', 'memory', 'background', 'isolation']
const SOURCES_INTRO = 'Load these selected knowledge skills when relevant before acting; load linked references only as needed. A skill id is preloaded through `skills:` or invoked with the Skill tool by that exact id (Agent Kit skills are `agent-kit:<skill>`, so a same-named skill elsewhere cannot replace them). A path is relative to the project root: read that file.'
const QUALIFIED = new RegExp(`^${PLUGIN_NAME}:`)
// Subagent `tools` and `disallowedTools` take tool names and MCP server patterns
// (`mcp__<server>`, `mcp__<server>__*`, `mcp__*`). A specifier such as
// `Bash(git push *)` is accepted by Claude Code but removes or grants the whole
// tool, so the materializer rejects it instead of writing a rule that looks
// narrower than it is.
const TOOL_ENTRY = /^(?:[A-Za-z][A-Za-z0-9_]*|mcp__\*|mcp__[A-Za-z0-9_-]+(?:__(?:\*|[A-Za-z0-9_-]+))?)$/

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
    for (const key of ['tools', 'disallowedTools']) {
      for (const entry of overlay[key] ?? []) {
        if (TOOL_ENTRY.test(entry)) continue
        throw new Error(`${origin}: ${key} entry ${JSON.stringify(entry)} is not a tool name. Claude Code subagent tool lists take tool names and mcp__<server> patterns; a specifier such as Bash(git push *) removes or grants the whole tool. To keep a tool and limit its use, add a permission rule (for example a Bash deny rule) to permissions in the project's Claude settings; it applies to subagents too.`)
      }
    }
  },

  resolve(profile, project, portable) {
    const settings = { ...profile, ...project }
    if (settings.model === null) delete settings.model
    settings.effort = layered(profile, project, portable.effort, portable.effortOverride, 'effort')
    const tools = layered(profile, project, TOOLS_BY_ACCESS[portable.access], portable.accessOverride, 'tools')
    // Claude Code applies disallowedTools first and resolves tools against the rest.
    const denied = new Set(settings.disallowedTools ?? [])
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
    const lines = ['---', `name: ${agent.name}`, `description: ${JSON.stringify(delegationDescription(agent))}`, `effort: ${settings.effort}`]
    for (const key of RENDERED) {
      if (settings[key] !== undefined) lines.push(`${key}: ${JSON.stringify(settings[key])}`)
    }
    const preload = sources.map(({ path }) => path).filter((path) => !isSkillPath(path))
    if (preload.length) lines.push(`skills: ${yamlList(preload)}`)
    lines.push(`tools: ${yamlList(settings.tools)}`)
    if (settings.disallowedTools?.length) lines.push(`disallowedTools: ${yamlList(settings.disallowedTools)}`)
    lines.push('---', '', generatedComments(source, provenance, true), '')
    return `${lines.join('\n')}${agent.body.trimEnd()}${projectInstructions(agent)}${knowledgeInstructions(sources, SOURCES_INTRO)}\n`
  },

  parse(content) {
    const issues = []
    const { front, body } = splitFrontmatter(content, 'target', issues)
    const { name, description, skills: preload = [], ...settings } = front
    const knowledge = splitKnowledge(stripGeneratedComments(body))
    // Diffs speak in skill names: the source list is complete, while
    // `skills:` holds qualified ids and omits path-only project skills.
    const listed = Object.keys(knowledge.sources)
    const skills = listed.length ? listed : preload.map((skill) => skill.replace(QUALIFIED, ''))
    return { name, description, skills, settings, body: knowledge.body, instructions: knowledge.instructions, sources: knowledge.sources, provenance: readProvenance(content) }
  },
}
