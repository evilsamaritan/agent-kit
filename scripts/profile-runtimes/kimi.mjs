import { join } from 'node:path'
import { splitFrontmatter } from '../profile-format.mjs'
import {
  generatedComments,
  knowledgeInstructions,
  layered,
  oneLine,
  projectInstructions,
  readProvenance,
  splitKnowledge,
  stringList,
  stripGeneratedComments,
  validateFields,
  yamlList,
} from './shared.mjs'

// Kimi Code built-in tool names. Agent/AgentSwarm stay out: the parent coordinates.
const KIMI_TOOLS_BY_ACCESS = {
  'read-only': ['Read', 'Grep', 'Glob', 'ReadMediaFile', 'WebSearch', 'FetchURL', 'Skill'],
  edits: ['Read', 'Grep', 'Glob', 'ReadMediaFile', 'WebSearch', 'FetchURL', 'Skill', 'Edit', 'Write'],
  full: ['Read', 'Grep', 'Glob', 'ReadMediaFile', 'WebSearch', 'FetchURL', 'Skill', 'Edit', 'Write', 'Bash', 'TaskList', 'TaskOutput', 'TaskStop', 'WaitFor'],
}
// Template variables Kimi substitutes in an agent body (0.29.0 and later docs);
// unknown ${...} stays verbatim.
const KIMI_TEMPLATE_VARIABLES = ['base_prompt', 'skills', 'skills_section', 'agents_md', 'cwd', 'cwd_listing', 'os', 'windows_notes', 'shell', 'now', 'role_additional', 'plugin_sections', 'additional_dirs_info', 'additional_dirs_section']
const TEMPLATE = new RegExp(`\\$\\{(${KIMI_TEMPLATE_VARIABLES.join('|')})\\}`, 'g')

const SOURCES_INTRO = 'Load these selected knowledge skills when relevant before acting with the Skill tool, by the exact quoted name; load linked references only as needed. The skill index in the base prompt lists where each one is installed.'
const identity = (agent) => `You are the project custom agent "${agent.name}", materialized from the Agent Kit profession profile "${agent.profile}".\n\n`
// A custom sub-agent body owns its whole system prompt. Start from Kimi's own base
// prompt (operating and safety rules, tools, AGENTS.md as project reference data,
// the skill index, the working directory), then add the profession and the handoff.
const defaultWhenToUse = (agent) => agent.access === 'read-only'
  ? 'Use instead of the built-in explore or coder for this work in this project, including a narrower scope inside it. Give it the scope to check and the settled design or specification to check against.'
  : 'Use instead of the built-in coder for this work in this project, including a narrower task inside it (a module, a layer, a set of files). Give it the files it owns and the settled design it follows.'
const BASE = '${base_prompt}\n\n# Project agent\n\n'
const HANDOFF = '\n\n## Handoff\n\nYour final message is returned to the delegating agent. Make it the complete, self-contained result: what you did, the evidence, and anything left open.'

export const kimi = {
  id: 'kimi',
  label: 'Kimi Code',
  directory: '.kimi-code/agents',
  extension: '.md',
  skillDirectories: ['.kimi-code/skills', '.agents/skills'],
  // Kimi lists every project root by bare skill name, project skills before plugins.
  discoveredSkillDirectories: ['.kimi-code/skills', '.agents/skills'],
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

  // Kimi does not namespace plugin skills; its Skill tool looks up the bare name.
  librarySkill(name) {
    return name
  },

  render(agent, sources, source, provenance) {
    for (const [label, text] of [['profile body', agent.body], ['description', agent.description], ['project instructions', agent.instructions ?? '']]) {
      const used = [...new Set([...text.matchAll(TEMPLATE)].map((match) => match[0]))]
      if (used.length) throw new Error(`${agent.name}: ${label} contains Kimi template variable(s) ${used.join(', ')}; Kimi would substitute them`)
    }
    const settings = agent.kimi
    const lines = ['---', `name: ${agent.name}`, `description: ${JSON.stringify(agent.description)}`]
    // Kimi lists description and whenToUse for every agent next to its built-in coder
    // and explore; the default whenToUse says when this project agent wins unless
    // the project turned the delegation hint off.
    const whenToUse = settings.whenToUse ?? (agent.delegationHint === false ? undefined : defaultWhenToUse(agent))
    if (whenToUse !== undefined) lines.push(`whenToUse: ${JSON.stringify(whenToUse)}`)
    lines.push(`tools: ${yamlList(settings.tools)}`)
    if (settings.disallowedTools?.length) lines.push(`disallowedTools: ${yamlList(settings.disallowedTools)}`)
    if (settings.subagents) lines.push(`subagents: ${yamlList(settings.subagents)}`)
    lines.push('---', '', generatedComments(source, provenance, true), '')
    return `${lines.join('\n')}${BASE}${identity(agent)}${agent.body.trimEnd()}${projectInstructions(agent)}${knowledgeInstructions(sources, SOURCES_INTRO)}${HANDOFF}\n`
  },

  parse(content) {
    const issues = []
    const { front, body } = splitFrontmatter(content, 'target', issues)
    const { name, description, ...settings } = front
    let text = stripGeneratedComments(body)
      .replace(/^\$\{base_prompt\}\n\n# Project agent\n\n/, '')
      .replace(/^You are the project custom agent "[^"]*", materialized from the Agent Kit profession profile "[^"]*"\.\n\n/, '')
    // rc.4 and earlier appended project context and the skill index; later targets end with the handoff.
    for (const marker of ['\n\n## Project context\n\n${agents_md}', '\n\n## Handoff\n\n']) {
      const cut = text.indexOf(marker)
      if (cut !== -1) text = text.slice(0, cut)
    }
    const knowledge = splitKnowledge(text)
    const skills = Object.keys(knowledge.sources)
    return { name, description, skills, settings, body: knowledge.body, instructions: knowledge.instructions, sources: knowledge.sources, provenance: readProvenance(content) }
  },
}
