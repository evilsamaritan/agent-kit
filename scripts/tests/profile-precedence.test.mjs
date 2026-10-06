import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { composeAgent, loadProfiles, renderTarget } from '../profile-lib.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const profiles = loadProfiles(root)
const architect = profiles.find((item) => item.name === 'architect')
const security = profiles.find((item) => item.name === 'security')
const toolsLine = (content) => content.split('\n').find((line) => line.startsWith('tools: '))

test('project read-only replaces write-capable library tools in every runtime', () => {
  const agent = composeAgent(architect, { access: 'read-only' })
  const claude = toolsLine(renderTarget('claude', agent))
  assert.doesNotMatch(claude, /"(?:Edit|Write|Bash)"/)
  assert.match(claude, /"Read"/)
  assert.match(renderTarget('codex', agent), /sandbox_mode = "read-only"/)
})

test('library tool narrowing applies when the project keeps the profile access', () => {
  assert.doesNotMatch(toolsLine(renderTarget('claude', composeAgent(architect))), /WebFetch/)
})

test('explicit project runtime tools remain the final choice', () => {
  const agent = composeAgent(security, { access: 'read-only', claude: { tools: ['Read', 'Bash'] } })
  assert.equal(toolsLine(renderTarget('claude', agent)), 'tools: ["Read", "Bash"]')
})

test('disallowed tools are removed from the resolved allowlist', () => {
  const agent = composeAgent(security, { claude: { disallowedTools: ['Bash(rm *)', 'WebFetch'] } })
  assert.deepEqual(agent.claude.tools.filter((tool) => ['Bash', 'WebFetch'].includes(tool)), [])
})

test('portable effort overrides library runtime effort; explicit runtime effort wins', () => {
  assert.match(renderTarget('codex', composeAgent(security, { effort: 'low' })), /model_reasoning_effort = "low"/)
  assert.match(renderTarget('codex', composeAgent(security, { effort: 'low', codex: { effort: 'high' } })), /model_reasoning_effort = "high"/)
  assert.match(renderTarget('claude', composeAgent(security, { effort: 'low' })), /^effort: low$/m)
})

test('Claude keeps read-only honest when memory would grant Write/Edit', () => {
  assert.throws(() => composeAgent(security, { access: 'read-only', claude: { memory: 'project' } }), /memory/)
})

test('Claude preloads library skills by qualified id, never by a bare name another plugin could match', () => {
  const agent = composeAgent(security, { skills: ['security'] })
  const target = renderTarget('claude', agent)
  assert.match(target, /^skills: \["agent-kit:security"\]$/m)
  assert.match(target, /^- security: "agent-kit:security"$/m)
})
