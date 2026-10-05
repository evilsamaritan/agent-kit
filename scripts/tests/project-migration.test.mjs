import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { composeAgent, loadProfiles, renderAgentBrief, renderTarget } from '../profile-lib.mjs'
import { migrateProjectConfig } from '../project-migrations.mjs'

const developer = loadProfiles(fileURLToPath(new URL('../../', import.meta.url))).find((p) => p.name === 'developer')
const resolved = (spec) => composeAgent(developer, spec)

test('legacy migration preserves identity, exact skills, and explicit settings without changing its input', () => {
  const input = { schema_version: 1, agents: [{ name: 'existing-ui', profile: 'frontend', skills: ['javascript'], effort: 'low', access: 'read-only', codex: { model: 'gpt-5.6-sol', effort: 'high' } }] }
  const result = migrateProjectConfig(input).agents[0]
  assert.equal(input.agents[0].profile, 'frontend')
  assert.equal(result.name, 'existing-ui')
  assert.equal(result.profile, 'developer')
  assert.deepEqual(result.skills, ['javascript'])
  assert.equal(result.effort, 'low')
  assert.equal(result.codex.model, 'gpt-5.6-sol')
  assert.equal(result.codex.effort, 'high')
  assert(!resolved(result).claude.tools.some((tool) => ['Edit', 'Write', 'Bash'].includes(tool)))
})

test('omitted old skills and models become explicit rather than adopting developer defaults', () => {
  const result = migrateProjectConfig({ schema_version: 1, agents: [{ name: 'backend', profile: 'backend' }] }).agents[0]
  assert.deepEqual(result.skills, ['backend', 'api-design', 'database', 'auth', 'caching'])
  assert.equal(result.access, 'full')
  assert.equal(result.claude.model, 'sonnet')
  assert.equal(result.codex.model, 'gpt-5.6-terra')
  assert.equal(result.claude.tools, undefined, 'backend tools equal the full-access set and need no pin')
})

test('frontend keeps its effective shell access without widening the declared access', () => {
  const result = migrateProjectConfig({ schema_version: 1, agents: [{ name: 'ui', profile: 'frontend' }] }).agents[0]
  assert.equal(result.access, 'edits')
  assert(resolved(result).claude.tools.includes('Bash'))
  assert.equal(resolved(result).codex.sandbox_mode, 'workspace-write')
})

test('unaffected entries and explicit project tool choices survive migration', () => {
  const input = { schema_version: 1, agents: [{ name: 'tester', profile: 'tester', skills: [] }, { name: 'ui', profile: 'frontend', access: 'read-only', claude: { tools: ['Read', 'Bash'] } }] }
  const result = migrateProjectConfig(input)
  assert.deepEqual(result.agents[0], input.agents[0])
  assert.deepEqual(result.agents[1].claude.tools, ['Read', 'Bash'])
})

test('renamed skills are replaced in explicit lists without reordering or touching other entries', () => {
  const input = { schema_version: 1, agents: [{ name: 'writer', profile: 'writer', skills: ['documentation', 'visualization', 'diagrams'] }, { name: 'reviewer', profile: 'reviewer' }] }
  const result = migrateProjectConfig(input)
  assert.deepEqual(result.agents[0].skills, ['documentation', 'playground', 'diagrams'])
  assert.deepEqual(result.agents[1], input.agents[1])
  assert.deepEqual(input.agents[0].skills, ['documentation', 'visualization', 'diagrams'])
})

test('named target and ephemeral brief share the selected profession body', () => {
  const agent = composeAgent(developer, { name: 'frontend-developer', skills: ['architecture'] })
  assert(renderTarget('claude', agent).includes(developer.body.trimEnd()))
  assert(renderAgentBrief(agent, [{ name: 'architecture', path: '/installed/architecture/SKILL.md' }]).includes(developer.body.trimEnd()))
  assert.match(renderAgentBrief(agent), /does not enforce native tool/)
})
