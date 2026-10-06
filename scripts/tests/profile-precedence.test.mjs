import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { composeAgent, composeSkills, loadProfiles, renderAgentBrief, renderTarget } from '../profile-lib.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const profiles = loadProfiles(root)
const architect = profiles.find((item) => item.name === 'architect')
const security = profiles.find((item) => item.name === 'security')
const developer = profiles.find((item) => item.name === 'developer')
const reviewer = profiles.find((item) => item.name === 'reviewer')
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

test('required skills stay first when a project replaces the skill list', () => {
  assert.deepEqual(composeAgent(developer, { skills: ['gamedev', 'javascript'] }).skills, ['development', 'gamedev', 'javascript'])
  assert.deepEqual(composeAgent(developer, { skills: ['javascript', 'development'] }).skills, ['development', 'javascript'])
  assert.deepEqual(composeAgent(developer, { skills: [] }).skills, ['development'])
  assert.deepEqual(composeAgent(reviewer).skills, reviewer.front.skills)
})

test('profiles without required skills keep the project list exactly', () => {
  const plain = { front: { skills: ['a', 'b'] } }
  assert.deepEqual(composeSkills(plain), ['a', 'b'])
  assert.deepEqual(composeSkills(plain, { skills: ['c'] }), ['c'])
  assert.deepEqual(composeSkills({ front: { skills: ['a'], requires: ['a'] } }, { skills: ['c', 'c'] }), ['a', 'c'])
})

test('generated targets preload required skills', () => {
  const target = renderTarget('claude', composeAgent(developer, { skills: ['rust'] }))
  assert.match(target, /^skills: \["agent-kit:development", "agent-kit:rust"\]$/m)
})

test('named target and ephemeral brief share the selected profession body', () => {
  const agent = composeAgent(developer, { name: 'frontend-developer', skills: ['frontend'] })
  assert(renderTarget('claude', agent).includes(developer.body.trimEnd()))
  assert(renderAgentBrief(agent, [{ name: 'frontend', path: '/installed/frontend/SKILL.md' }]).includes(developer.body.trimEnd()))
  assert.match(renderAgentBrief(agent), /does not enforce native tool/)
})
