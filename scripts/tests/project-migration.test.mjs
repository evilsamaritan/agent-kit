import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadProfiles, composeAgent, renderAgentBrief, renderClaudeAgent } from '../profile-lib.mjs'
import { migrateProjectConfig } from '../project-migrations.mjs'
import { fileURLToPath } from 'node:url'

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
  assert(!result.claude.tools.some((tool) => ['Edit', 'Write', 'Bash'].includes(tool)))
})

test('omitted old skills and model become explicit rather than adopting developer defaults', () => {
  const result = migrateProjectConfig({ schema_version: 1, agents: [{ name: 'backend', profile: 'backend' }] }).agents[0]
  assert.deepEqual(result.skills, ['backend', 'api-design', 'database', 'auth', 'caching'])
  assert.equal(result.access, 'full')
  assert.equal(result.claude.model, 'sonnet')
  assert.equal(result.codex.model, 'gpt-5.6-terra')
})

test('unaffected entries and explicit project tool choices survive migration', () => {
  const input = { schema_version: 1, agents: [{ name: 'tester', profile: 'tester', skills: [] }, { name: 'ui', profile: 'frontend', access: 'read-only', claude: { tools: ['Read', 'Bash'] } }] }
  const result = migrateProjectConfig(input)
  assert.deepEqual(result.agents[0], input.agents[0])
  assert.deepEqual(result.agents[1].claude.tools, ['Read', 'Bash'])
})

test('named target and ephemeral brief share the selected profession body', () => {
  const profile = loadProfiles(fileURLToPath(new URL('../../', import.meta.url))).find((p) => p.name === 'developer')
  const agent = composeAgent(profile, { name: 'frontend-developer', skills: ['architecture'] })
  assert(renderClaudeAgent(agent).includes(profile.body.trimEnd()))
  assert(renderAgentBrief(agent, ['/installed/architecture/SKILL.md']).includes(profile.body.trimEnd()))
  assert.match(renderAgentBrief(agent), /does not enforce native tool/)
})
