import assert from 'node:assert/strict'
import { test } from 'node:test'
import { composeAgent, loadProfiles, renderClaudeAgent, renderCodexAgent } from '../profile-lib.mjs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const profile = loadProfiles(root).find((item) => item.name === 'security')

test('project read-only overrides write-capable library tools in rendered targets', () => {
  const agent = composeAgent(profile, { access: 'read-only' })
  const claude = renderClaudeAgent(agent).split('\n').find((line) => line.startsWith('tools: '))
  assert.doesNotMatch(claude, /"(?:Edit|Write|Bash)"/)
  assert.match(claude, /"Read"/)
  assert.match(renderCodexAgent(agent), /sandbox_mode = "read-only"/)
})

test('explicit project tool override remains the final choice', () => {
  const agent = composeAgent(profile, { access: 'read-only', claude: { tools: ['Read', 'Bash'] } })
  assert.match(renderClaudeAgent(agent), /tools: \["Read", "Bash"\]/)
})

test('portable project effort overrides library runtime effort; explicit runtime effort wins', () => {
  assert.match(renderCodexAgent(composeAgent(profile, { effort: 'low' })), /model_reasoning_effort = "low"/)
  assert.match(renderCodexAgent(composeAgent(profile, { effort: 'low', codex: { effort: 'high' } })), /model_reasoning_effort = "high"/)
  assert.deepEqual(composeAgent(profile).claude.tools, profile.claude.tools)
})

test('Claude receives the resolved source without depending on bare-name discovery', () => {
  const agent = composeAgent(profile, { skills: ['security'] })
  const target = renderClaudeAgent(agent, 'test composition', ['/installed/agent-kit/skills/security/SKILL.md'])
  assert.match(target, /security: "\/installed\/agent-kit\/skills\/security\/SKILL.md"/)
  assert.match(target, /source paths as the authoritative/)
})
