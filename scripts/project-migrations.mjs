import { readFileSync } from 'node:fs'
import { composeAgent } from './profile-lib.mjs'
import { TOOLS_BY_ACCESS } from './profile-runtimes/claude.mjs'

// Skills renamed in 4.0; explicit project lists are rewritten in place.
export const RENAMED_SKILLS = { visualization: 'playground' }

const legacy = JSON.parse(readFileSync(new URL('./legacy-profile-defaults.json', import.meta.url), 'utf8'))
const pick = (object, keys) => Object.fromEntries(keys.filter((key) => object?.[key] !== undefined).map((key) => [key, object[key]]))
const sameList = (a, b) => a.length === b.length && a.every((item, index) => item === b[index])

// frontend/backend → developer, and renamed skills in explicit lists. Keep the project name, exact skills, explicit
// settings, and the effective defaults of the retired profile; do not adopt the
// new profile's defaults silently.
export function migrateProjectConfig(config) {
  if (!config || config.schema_version !== 1 || !Array.isArray(config.agents)) {
    throw new Error('Migration requires schema_version: 1 and an agents array')
  }
  const migrated = structuredClone(config)
  for (const spec of migrated.agents) {
    if (Array.isArray(spec.skills)) spec.skills = spec.skills.map((skill) => RENAMED_SKILLS[skill] ?? skill)
    const previous = legacy[spec.profile]
    if (!previous) continue
    const effective = composeAgent(previous, spec)
    spec.profile = 'developer'
    spec.description ??= previous.front.description
    spec.skills = effective.skills
    spec.effort = effective.effort
    spec.access = effective.access
    const claude = { ...pick(previous.claude, ['model', 'color']), ...spec.claude }
    if (claude.tools === undefined && !sameList(effective.claude.tools, TOOLS_BY_ACCESS[effective.access])) {
      claude.tools = effective.claude.tools
    }
    spec.claude = claude
    spec.codex = { ...pick(previous.codex, ['model']), ...spec.codex }
  }
  return migrated
}
