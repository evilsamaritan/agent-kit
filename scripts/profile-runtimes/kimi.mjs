import { join } from 'node:path'
import { splitFrontmatter } from '../profile-format.mjs'
import {
  generatedComments,
  knowledgeInstructions,
  layered,
  oneLine,
  readProvenance,
  splitKnowledge,
  stringList,
  stripGeneratedComments,
  validateFields,
  yamlList,
} from './shared.mjs'

// Kimi Code built-in tool names. Agent/AgentSwarm stay out: the parent coordinates.
export const KIMI_TOOLS_BY_ACCESS = {
  'read-only': ['Read', 'Grep', 'Glob', 'ReadMediaFile', 'WebSearch', 'FetchURL', 'Skill'],
  edits: ['Read', 'Grep', 'Glob', 'ReadMediaFile', 'WebSearch', 'FetchURL', 'Skill', 'Edit', 'Write'],
  full: ['Read', 'Grep', 'Glob', 'ReadMediaFile', 'WebSearch', 'FetchURL', 'Skill', 'Edit', 'Write', 'Bash', 'TaskList', 'TaskOutput', 'TaskStop', 'WaitFor'],
}
// Template variables Kimi substitutes in an agent body; unknown ${...} stays verbatim.
export const KIMI_TEMPLATE_VARIABLES = ['base_prompt', 'skills', 'agents_md', 'cwd', 'cwd_listing', 'os', 'shell', 'now', 'plugin_sections', 'additional_dirs_info']
const TEMPLATE = new RegExp(`\\$\\{(${KIMI_TEMPLATE_VARIABLES.join('|')})\\}`, 'g')

const identity = (agent) => `You are the project custom agent "${agent.name}", materialized from the Agent Kit profession profile "${agent.profile}".\n\n`
// A custom sub-agent body owns its whole system prompt. Bring back the project
// instructions and skill index on purpose, and define the handoff.
const CONTEXT = '\n\n## Project context\n\n${agents_md}\n\n## Available skills\n\n${skills}\n\n## Handoff\n\nYour final message is returned to the delegating agent. Make it the complete, self-contained result: what you did, the evidence, and anything left open.'

export const kimi = {
  id: 'kimi',
  label: 'Kimi Code',
  directory: '.kimi-code/agents',
  extension: '.md',
  skillDirectories: ['.kimi-code/skills', '.agents/skills'],
  // Kimi custom agents have no model or effort fields; the parent's Agent call
  // chooses a model only when a subagent model pool is configured.
  schema: {
    whenToUse: oneLine,
    tools: stringList,
    disallowedTools: stringList,
    subagents: stringList,
  },
  // Built-in agent names; a directory-discovered file cannot replace them without `override: true`.
  reservedNames: ['coder', 'explore', 'plan'],
  limitations: ['effort and model are not applied by Kimi custom agents; the parent chooses a model only through a configured subagent model pool'],

  validate(overlay, origin) {
    validateFields(overlay, this.schema, origin)
  },

  resolve(profile, project, portable) {
    const settings = { ...profile, ...project }
    const tools = layered(profile, project, KIMI_TOOLS_BY_ACCESS[portable.access], portable.accessOverride, 'tools')
    const denied = new Set(settings.disallowedTools ?? [])
    settings.tools = tools.filter((tool) => !denied.has(tool))
    return settings
  },

  targetPath(root, name) {
    return join(root, this.directory, `${name}${this.extension}`)
  },

  render(agent, sources, source, provenance) {
    for (const [label, text] of [['profile body', agent.body], ['description', agent.description]]) {
      const used = [...new Set([...text.matchAll(TEMPLATE)].map((match) => match[0]))]
      if (used.length) throw new Error(`${agent.name}: ${label} contains Kimi template variable(s) ${used.join(', ')}; Kimi would substitute them`)
    }
    const settings = agent.kimi
    const lines = ['---', `name: ${agent.name}`, `description: ${JSON.stringify(agent.description)}`]
    if (settings.whenToUse) lines.push(`whenToUse: ${JSON.stringify(settings.whenToUse)}`)
    lines.push(`tools: ${yamlList(settings.tools)}`)
    if (settings.disallowedTools?.length) lines.push(`disallowedTools: ${yamlList(settings.disallowedTools)}`)
    if (settings.subagents) lines.push(`subagents: ${yamlList(settings.subagents)}`)
    lines.push('---', '', generatedComments(source, provenance, true), '')
    return `${lines.join('\n')}${identity(agent)}${agent.body.trimEnd()}${knowledgeInstructions(sources)}${CONTEXT}\n`
  },

  parse(content) {
    const issues = []
    const { front, body } = splitFrontmatter(content, 'target', issues)
    const { name, description, ...settings } = front
    let text = stripGeneratedComments(body).replace(/^You are the project custom agent "[^"]*", materialized from the Agent Kit profession profile "[^"]*"\.\n\n/, '')
    const context = text.indexOf('\n\n## Project context\n\n${agents_md}')
    if (context !== -1) text = text.slice(0, context)
    const knowledge = splitKnowledge(text)
    const skills = Object.keys(knowledge.sources)
    return { name, description, skills, settings, body: knowledge.body, sources: knowledge.sources, provenance: readProvenance(content) }
  },
}
