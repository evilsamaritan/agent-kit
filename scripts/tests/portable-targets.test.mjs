import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

// End-to-end portability: two "machines" (different home, user name, install
// root, and project location) materialize the same recipe from separate copies
// of the kit. Only synthetic fixtures under a temporary directory are used.
const repo = fileURLToPath(new URL('../../', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'agent-kit-portable-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const KIT_FILES = ['AGENTS.md', 'profiles', 'scripts', 'skills', '.claude-plugin', '.codex-plugin', '.kimi-plugin']
const version = readFileSync(join(repo, 'AGENTS.md'), 'utf8').split('\n', 1)[0].replace('# agent-kit v', '')

function installKit(home, kitVersion = version) {
  const root = join(home, '.claude', 'plugins', 'cache', 'agent-kit', 'agent-kit', kitVersion)
  for (const entry of KIT_FILES) cpSync(join(repo, entry), join(root, entry), { recursive: true })
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8').split('\n')
  agents[0] = `# agent-kit v${kitVersion}`
  writeFileSync(join(root, 'AGENTS.md'), agents.join('\n'))
  return root
}

const recipe = {
  schema_version: 1,
  agents: [
    { name: 'backend-developer', profile: 'developer', skills: ['architecture', 'backend', 'team-rules'], runtimes: ['claude', 'codex', 'kimi'] },
    { name: 'reviewer', profile: 'reviewer', access: 'read-only', runtimes: ['claude', 'codex', 'kimi'] },
    { name: 'tester', profile: 'tester', skills: ['testing'] },
  ],
}

function createProject(root) {
  mkdirSync(join(root, '.agent-kit'), { recursive: true })
  writeFileSync(join(root, '.agent-kit', 'agents.json'), `${JSON.stringify(recipe, null, 2)}\n`)
  // A project-local skill every runtime discovers from the shared .agents/skills root.
  mkdirSync(join(root, '.agents', 'skills', 'team-rules'), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', 'team-rules', 'SKILL.md'), '---\nname: team-rules\ndescription: Team conventions.\n---\n\nFollow the team rules.\n')
  return root
}

function machine(user) {
  const home = join(scratch, user)
  return { user, home, kit: installKit(home), project: createProject(join(home, 'work', 'project')) }
}

function materialize(kit, home, project, ...args) {
  const script = join(kit, 'skills', 'agent-creator', 'scripts', 'materialize-agents.mjs')
  const result = spawnSync(process.execPath, [script, '--project-root', project, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USER: relative(scratch, home), LOGNAME: relative(scratch, home) },
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

function targets(project) {
  const files = {}
  for (const dir of ['.claude/agents', '.codex/agents', '.kimi-code/agents']) {
    let entries = []
    try { entries = readdirSync(join(project, dir)) } catch { continue }
    for (const entry of entries) files[`${dir}/${entry}`] = readFileSync(join(project, dir, entry), 'utf8')
  }
  return files
}

const alice = machine('alice')
const bob = machine('bob')
const first = materialize(alice.kit, alice.home, alice.project)
const second = materialize(bob.kit, bob.home, bob.project)

test('materialization succeeds on both machines', () => {
  assert.equal(first.status, 0, first.output)
  assert.equal(second.status, 0, second.output)
})

test('two machines generate byte-identical targets for all three runtimes', () => {
  const a = targets(alice.project)
  const b = targets(bob.project)
  assert.deepEqual(Object.keys(a).sort(), [
    '.claude/agents/backend-developer.md', '.claude/agents/reviewer.md', '.claude/agents/tester.md',
    '.codex/agents/backend-developer.toml', '.codex/agents/reviewer.toml', '.codex/agents/tester.toml',
    '.kimi-code/agents/backend-developer.md', '.kimi-code/agents/reviewer.md',
  ])
  for (const [path, content] of Object.entries(a)) assert.equal(content, b[path], path)
})

test('no target contains an absolute path, home directory, user name, install root, or kit version', () => {
  for (const [path, content] of Object.entries(targets(alice.project))) {
    for (const leak of [scratch, alice.home, alice.kit, alice.project, 'alice', '/Users/', '/home/', '~/', '$HOME', 'plugins/cache', version]) {
      assert(!content.includes(leak), `${path} contains ${leak}`)
    }
    assert.doesNotMatch(content, /"\/[^"]*SKILL\.md"/, `${path} has an absolute SKILL.md path`)
  }
})

test('a fresh clone on another machine passes --check without regeneration', () => {
  const clone = join(scratch, 'carol', 'checkout')
  cpSync(alice.project, clone, { recursive: true })
  const result = materialize(bob.kit, bob.home, clone, '--check')
  assert.equal(result.status, 0, result.output)
})

test('a kit upgrade without content changes leaves committed targets untouched', () => {
  const before = targets(alice.project)
  const upgraded = installKit(join(scratch, 'alice-upgrade'), '9.9.9-test')
  const check = materialize(upgraded, alice.home, alice.project, '--check')
  assert.equal(check.status, 0, check.output)
  const write = materialize(upgraded, alice.home, alice.project)
  assert.equal(write.status, 0, write.output)
  assert.match(write.output, /Materialized 0 changed/)
  assert.deepEqual(targets(alice.project), before)
})

test('--check rejects a target that carries a machine-local path', () => {
  const project = join(scratch, 'dave', 'project')
  cpSync(alice.project, project, { recursive: true })
  const path = join(project, '.codex', 'agents', 'reviewer.toml')
  const leaked = `${readFileSync(path, 'utf8')}\n[[skills.config]]\npath = "${join(alice.kit, 'skills', 'architecture', 'SKILL.md')}"\nenabled = true\n`
  writeFileSync(path, leaked)
  const result = materialize(bob.kit, bob.home, project, '--check')
  assert.notEqual(result.status, 0)
  assert.match(result.output, /not portable/)
})
