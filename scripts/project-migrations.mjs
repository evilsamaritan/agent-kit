import { readFileSync } from 'node:fs'
import { composeAgent } from './profile-lib.mjs'

const legacy = JSON.parse(readFileSync(new URL('./legacy-profile-defaults.json', import.meta.url), 'utf8'))

export function migrateProjectConfig(config) {
  if (!config || config.schema_version !== 1 || !Array.isArray(config.agents)) {
    throw new Error('Migration requires schema_version: 1 and an agents array')
  }
  const migrated = structuredClone(config)
  for (const spec of migrated.agents) {
    const previous = legacy[spec.profile]
    if (!previous) continue
    // Resolve the old intent with corrected priority. An accidentally overprivileged
    // native target is not a compatibility requirement.
    const effective = composeAgent(previous, spec)
    spec.profile = 'developer'
    spec.description ??= previous.front.description
    spec.skills = effective.skills
    spec.effort = effective.effort
    spec.access = effective.access
    spec.claude = effective.claude
    spec.codex = effective.codex
  }
  return migrated
}
