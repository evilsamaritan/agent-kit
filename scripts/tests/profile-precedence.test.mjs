import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { composeAgent, composeSkills, compositionFingerprint, loadProfiles, renderAgentBrief, renderTarget, runtimeRegistry } from '../profile-lib.mjs'
import { compareTargets } from '../profile-runtimes/shared.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const profiles = loadProfiles(root)
const architect = profiles.find((item) => item.name === 'architect')
const sre = profiles.find((item) => item.name === 'sre')
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
  const agent = composeAgent(sre, { access: 'read-only', claude: { tools: ['Read', 'Bash'] } })
  assert.equal(toolsLine(renderTarget('claude', agent)), 'tools: ["Read", "Bash"]')
})

test('disallowed tool names are removed from the resolved allowlist; specifiers are rejected, not truncated', () => {
  const agent = composeAgent(sre, { claude: { disallowedTools: ['WebFetch'] } })
  assert.deepEqual(agent.claude.tools.filter((tool) => ['Bash', 'WebFetch'].includes(tool)), ['Bash'])
  const claude = runtimeRegistry.get('claude')
  // Claude Code removes the whole tool for a specifier entry; writing one would look narrower than it is.
  assert.throws(() => claude.validate({ disallowedTools: ['Bash(git commit:*)'] }, 'spec'), /disallowedTools entry "Bash\(git commit:\*\)" is not a tool name.*permissions/)
  assert.throws(() => claude.validate({ tools: ['Read', 'Edit(docs/**)'] }, 'spec'), /tools entry "Edit\(docs\/\*\*\)" is not a tool name/)
  assert.throws(() => claude.validate({ tools: ['Agent(worker)'] }, 'spec'), /not a tool name/)
  assert.doesNotThrow(() => claude.validate({ tools: ['Read', 'mcp__github', 'mcp__db__query', 'mcp__db__*'], disallowedTools: ['mcp__*', 'WebFetch'] }, 'spec'))
})

test('project instructions follow the profession body in every runtime and round-trip through the diff', () => {
  const text = 'Run `cargo fmt --check` before reporting.\nNever edit tests/**.\nReport in Russian.'
  const agent = composeAgent(developer, { name: 'ox-implementer', skills: ['rust'], instructions: ['Run `cargo fmt --check` before reporting.', 'Never edit tests/**.', 'Report in Russian.'] })
  assert.equal(agent.instructions, text)
  for (const id of ['claude', 'codex', 'kimi']) {
    const runtime = runtimeRegistry.get(id)
    const target = renderTarget(id, agent)
    const parsed = runtime.parse(target)
    assert.equal(parsed.instructions, text, id)
    assert.equal(parsed.body, developer.body.trimEnd(), `${id}: instructions do not leak into the profile body`)
    assert.deepEqual(parsed.skills, ['development', 'rust'], id)
    const bodyAt = target.indexOf('## Role — implementer')
    const instructionsAt = target.indexOf('## Project instructions')
    const sourcesAt = target.indexOf('## Selected knowledge sources')
    assert(bodyAt < instructionsAt && instructionsAt < sourcesAt, `${id}: body, then instructions, then sources`)
    const plain = runtime.parse(renderTarget(id, composeAgent(developer, { name: 'ox-implementer', skills: ['rust'] })))
    const diff = compareTargets(plain, parsed)
    assert.equal(diff.kind, 'semantic')
    assert.deepEqual(diff.changes, ['project instructions changed'], id)
  }
  assert.match(renderAgentBrief(agent), /## Project instructions\n\nRun `cargo fmt --check`/)
  assert.throws(() => composeAgent(developer, { name: 'a', instructions: '' }), /instructions must not be empty/)
  assert.throws(() => composeAgent(developer, { name: 'a', instructions: ['ok', 3] }), /instructions must be a non-empty string or an array of strings/)
  assert.throws(() => composeAgent(developer, { name: 'a', instructions: 'x\n## Selected knowledge sources\ny' }), /must not contain the heading/)
})

test('instructions and delegation_hint enter the fingerprint only when set, so 4.0 fingerprints survive', () => {
  const spec = { name: 'reviewer', profile: 'reviewer', skills: ['architecture'] }
  const print = (recipe) => compositionFingerprint(composeAgent(reviewer, recipe), 'claude', [{ name: 'architecture', path: 'agent-kit:architecture' }])
  assert.equal(print(spec), print({ ...spec, delegation_hint: true }))
  assert.notEqual(print(spec), print({ ...spec, delegation_hint: false }))
  assert.notEqual(print(spec), print({ ...spec, instructions: 'Never commit.' }))
})

test('portable effort overrides library runtime effort; explicit runtime effort wins', () => {
  assert.match(renderTarget('codex', composeAgent(sre, { effort: 'low' })), /model_reasoning_effort = "low"/)
  assert.match(renderTarget('codex', composeAgent(sre, { effort: 'low', codex: { effort: 'high' } })), /model_reasoning_effort = "high"/)
  assert.match(renderTarget('claude', composeAgent(sre, { effort: 'low' })), /^effort: low$/m)
})

test('Claude keeps read-only honest when memory would grant Write/Edit', () => {
  assert.throws(() => composeAgent(sre, { access: 'read-only', claude: { memory: 'project' } }), /memory/)
})

test('Claude preloads library skills by qualified id, never by a bare name another plugin could match', () => {
  const agent = composeAgent(sre, { skills: ['reliability'] })
  const target = renderTarget('claude', agent)
  assert.match(target, /^skills: \["agent-kit:reliability"\]$/m)
  assert.match(target, /^- reliability: "agent-kit:reliability"$/m)
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
