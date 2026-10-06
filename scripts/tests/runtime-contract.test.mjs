import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { composeAgent, compositionFingerprint, loadProfiles, renderTarget, runtimeRegistry } from '../profile-lib.mjs'
import { parseFlatYaml } from '../profile-format.mjs'
import { PLUGIN_NAME, compareTargets, skillLocator } from '../profile-runtimes/shared.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const profiles = loadProfiles(root)
const reviewer = profiles.find((p) => p.name === 'reviewer')
const claude = runtimeRegistry.get('claude')
const codex = runtimeRegistry.get('codex')
const kimi = runtimeRegistry.get('kimi')
const source = (path) => [{ name: 'architecture', path }]
const provenance = { inputs: 'abc' }

test('library profiles pin no model; both runtimes inherit by omission', () => {
  for (const profile of profiles) {
    const agent = composeAgent(profile)
    assert.equal(agent.claude.model, undefined, profile.name)
    assert.equal(agent.codex.model, undefined, profile.name)
    assert.doesNotMatch(renderTarget('claude', agent), /^model:/m)
    assert.doesNotMatch(renderTarget('codex', agent), /^model =/m)
  }
})

test('model availability belongs to the host: any current alias or ID is accepted', () => {
  assert.match(renderTarget('codex', composeAgent(reviewer, { codex: { model: 'gpt-6.1-sol' } })), /^model = "gpt-6.1-sol"$/m)
  assert.match(renderTarget('claude', composeAgent(reviewer, { claude: { model: 'opus' } })), /^model: "opus"$/m)
  assert.match(renderTarget('claude', composeAgent(reviewer, { claude: { model: 'inherit' } })), /^model: "inherit"$/m)
  assert.doesNotMatch(renderTarget('codex', composeAgent(reviewer, { codex: { model: 'inherit' } })), /^model =/m)
  assert.throws(() => codex.validate({ model: 'two\nlines' }, 'spec'), /invalid model/)
  assert.throws(() => claude.validate({ modle: 'opus' }, 'spec'), /unsupported field "modle"/)
})

test('YAML overlays and JSON project overrides normalize to the same types', () => {
  const overlay = parseFlatYaml('maxTurns: 20\nbackground: true\ntools: [Read, "Bash(git *)"]\nmodel: "claude-opus-5-5"', 'test')
  assert.deepEqual(overlay, { maxTurns: 20, background: true, tools: ['Read', 'Bash(git *)'], model: 'claude-opus-5-5' })
  claude.validate(overlay, 'test')
})

test('Codex targets carry no skills.config: role files may only disable skills', () => {
  const target = renderTarget('codex', composeAgent(reviewer, { skills: ['architecture'] }))
  assert.doesNotMatch(target, /skills\.config/)
  assert.match(target, /- architecture: \\"agent-kit:architecture\\"/)
})

test('every manifest names the plugin whose skill namespace targets use', () => {
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.kimi-plugin/plugin.json']) {
    assert.equal(JSON.parse(readFileSync(`${root}${manifest}`, 'utf8')).name, PLUGIN_NAME, manifest)
  }
})

test('locators: library skills by host identifier, discovered project skills by name, others by project path', () => {
  const library = { name: 'architecture', project: false }
  assert.equal(skillLocator(claude, library), 'agent-kit:architecture')
  assert.equal(skillLocator(codex, library), 'agent-kit:architecture')
  assert.equal(skillLocator(kimi, library), 'architecture')
  const project = (directory) => ({ name: 'rules', project: true, directory, relative: `${directory}/rules/SKILL.md` })
  assert.equal(skillLocator(claude, project('.claude/skills')), 'rules')
  assert.equal(skillLocator(claude, project('.agents/skills')), '.agents/skills/rules/SKILL.md')
  assert.equal(skillLocator(codex, project('.agents/skills')), 'rules')
  assert.equal(skillLocator(codex, project('skills')), 'skills/rules/SKILL.md')
  assert.equal(skillLocator(kimi, project('.kimi-code/skills')), 'rules')
})

for (const runtime of [claude, codex, kimi]) {
  test(`${runtime.id}: rendering names skills by identifier, never by a path on this machine`, () => {
    const agent = composeAgent(reviewer, { skills: ['architecture', 'rules', 'notes'] })
    const sources = [
      { name: 'architecture', path: skillLocator(runtime, { name: 'architecture', project: false }) },
      { name: 'rules', path: skillLocator(runtime, { name: 'rules', project: true, directory: '.agents/skills', relative: '.agents/skills/rules/SKILL.md' }) },
      { name: 'notes', path: 'skills/notes/SKILL.md' },
    ]
    const target = renderTarget(runtime.id, agent, sources, '.agent-kit/agents.json profile reviewer', { inputs: compositionFingerprint(agent, runtime.id, sources) })
    assert.doesNotMatch(target, /"\/|\\"\/|~\/|\d+\.\d+\.\d+/)
    assert.deepEqual(runtime.parse(target).skills, ['architecture', 'rules', 'notes'])
    if (runtime === claude) assert.match(target, /^skills: \["agent-kit:architecture"\]$/m, 'path-only project skills are not preloaded by a guessable name')
  })


  test(`${runtime.id}: diff separates source, provenance, and behavior changes`, () => {
    const agent = composeAgent(reviewer, { skills: ['architecture'] })
    const library = source(runtime.librarySkill('architecture'))
    const base = runtime.parse(renderTarget(runtime.id, agent, library, 'x', provenance))
    assert.equal(compareTargets(base, base).kind, 'none')
    const relocated = runtime.parse(renderTarget(runtime.id, agent, source('.agents/skills/architecture/SKILL.md'), 'x', provenance))
    const moved = compareTargets(base, relocated)
    assert.equal(moved.kind, 'sources')
    assert.match(moved.changes.join('\n'), /source for architecture: .* → \.agents\/skills\/architecture\/SKILL\.md/)
    const legacy = runtime.parse(renderTarget(runtime.id, agent, source('/a/4.0.0-rc.1/skills/architecture/SKILL.md'), 'x', { kit: '4.0.0-rc.1', inputs: 'abc' }))
    const upgrade = compareTargets(legacy, base)
    assert.equal(upgrade.kind, 'sources')
    assert.match(upgrade.changes.join('\n'), /kit version 4\.0\.0-rc\.1 no longer recorded/)
    const refingerprinted = runtime.parse(renderTarget(runtime.id, agent, library, 'x', { inputs: 'def' }))
    assert.equal(compareTargets(base, refingerprinted).kind, 'provenance')
    const changed = runtime.parse(renderTarget(runtime.id, { ...agent, body: `${agent.body}\nNew duty.` }, library, 'x', provenance))
    const result = compareTargets(base, changed)
    assert.equal(result.kind, 'semantic')
    assert.match(result.changes.join('\n'), /profile behavior changed/)
    const narrowed = runtime.parse(renderTarget(runtime.id, composeAgent(reviewer, { skills: ['architecture'], access: 'full' }), library, 'x', provenance))
    assert.equal(compareTargets(base, narrowed).kind, 'semantic')
    if (runtime !== kimi) {
      const pinned = runtime.parse(renderTarget(runtime.id, composeAgent(reviewer, { skills: ['architecture'], [runtime.id]: { model: 'opus' } }), library, 'x', provenance))
      assert.match(compareTargets(base, pinned).changes.join('\n'), /model: \(inherit\/default\) → opus/)
    }
  })
}

test('3.4.1-format targets parse as an unknown baseline with their old settings', () => {
  const oldClaude = '---\nname: judy-security\ndescription: "Read-only review."\neffort: high\nmodel: opus\nskills: ["security"]\ntools: ["Read", "Edit", "Bash"]\n---\n\n<!-- Generated by agent-kit from .agent-kit/agents.json profile security. Do not edit by hand. -->\nYou are a reviewer.\n'
  const parsed = claude.parse(oldClaude)
  assert.equal(parsed.provenance, undefined)
  assert.equal(parsed.settings.model, 'opus')
  assert.equal(parsed.body, 'You are a reviewer.')
  const oldCodex = '# Generated by agent-kit from .agent-kit/agents.json profile security. Do not edit by hand.\nname = "judy-security"\ndescription = "Read-only review."\nmodel = "gpt-5.6-sol"\nmodel_reasoning_effort = "high"\nsandbox_mode = "read-only"\ndeveloper_instructions = "You are the project custom agent \\"judy-security\\", materialized from the Agent Kit profession profile \\"security\\".\\n\\nYou are a reviewer.\\n\\nBefore acting, read and follow these installed knowledge skills when relevant: security.\\n"\n\n[[skills.config]]\npath = "/old/3.4.1/skills/security/SKILL.md"\nenabled = true\n'
  const codexParsed = codex.parse(oldCodex)
  assert.deepEqual(codexParsed.skills, ['security'])
  assert.equal(codexParsed.body, 'You are a reviewer.')
  assert.equal(codexParsed.settings.model, 'gpt-5.6-sol')
})

test('composition fingerprint follows the resolved agent, not raw inputs or other runtimes', () => {
  const spec = { name: 'reviewer', profile: 'reviewer', skills: ['architecture'] }
  const print = (profile, recipe, runtime = 'claude') => compositionFingerprint(composeAgent(profile, recipe), runtime, source('agent-kit:architecture'))
  assert.equal(print(reviewer, spec), print(reviewer, { ...spec }))
  assert.equal(print({ ...reviewer, front: { ...reviewer.front, skills: ['security'] } }, spec), print(reviewer, spec), 'replaced library defaults do not churn an explicit composition')
  assert.equal(print(reviewer, { ...spec, codex: { effort: 'high' }, runtimes: ['claude', 'codex'] }), print(reviewer, spec), 'another runtime\'s override is not an input')
  assert.notEqual(print(reviewer, { ...spec, effort: 'low' }), print(reviewer, spec))
  assert.notEqual(print({ ...reviewer, body: `${reviewer.body}x` }, spec), print(reviewer, spec))
  assert.notEqual(compositionFingerprint(composeAgent(reviewer, spec), 'claude', source('.agents/skills/architecture/SKILL.md')), print(reviewer, spec))
})

test('Kimi target: explicit allowlist by access, context restored on purpose, no model or effort fields', () => {
  const readOnly = renderTarget('kimi', composeAgent(reviewer))
  const tools = readOnly.split('\n').find((line) => line.startsWith('tools: '))
  assert.doesNotMatch(tools, /"(?:Edit|Write|Bash|Agent|AgentSwarm)"/)
  assert.match(tools, /"Read"/)
  assert.doesNotMatch(readOnly, /^(model|effort):/m)
  for (const part of ['${base_prompt}', '## Handoff', 'development: "development"', 'Skill tool']) assert(readOnly.includes(part), part)
  assert(readOnly.indexOf('${base_prompt}') < readOnly.indexOf('You are the project custom agent'), 'the base prompt comes first')
  assert.doesNotMatch(readOnly, /\$\{(agents_md|skills)\}/, 'project context comes from the base prompt, not raw variables')
  const full = renderTarget('kimi', composeAgent(reviewer, { access: 'full' }))
  assert.match(full, /"Bash"/)
  assert.doesNotMatch(full, /"Agent"/)
})

test('Kimi rejects profile text that its template engine would substitute', () => {
  const agent = composeAgent(reviewer)
  assert.throws(() => renderTarget('kimi', { ...agent, body: `${agent.body}\nUse \${cwd} here.` }), /template variable/)
  assert.doesNotThrow(() => renderTarget('kimi', { ...agent, body: `${agent.body}\nconst x = \`\${value}\`` }))
  assert.throws(() => kimi.validate({ model: 'k2' }, 'spec'), /unsupported field "model"/)
})

test('generated agents tell the host to prefer them over generic subagents', () => {
  const agent = composeAgent(reviewer, { name: 'game-reviewer', description: 'Review game changes.' })
  for (const id of ['claude', 'codex']) {
    const description = runtimeRegistry.get(id).parse(renderTarget(id, agent)).description
    assert.match(description, /^Review game changes\. Project agent with the reviewer profession/)
    assert.match(description, /instead of a generic subagent for this work, including a narrower task inside it\.$/)
  }
  const kimiTarget = renderTarget('kimi', agent)
  assert.match(kimiTarget, /^description: "Review game changes\."$/m)
  assert.match(kimiTarget, /^whenToUse: "Use instead of the built-in explore or coder/m)
  assert.match(renderTarget('kimi', composeAgent(reviewer, { kimi: { whenToUse: 'Code reviews only' } })), /^whenToUse: "Code reviews only"$/m)
})
