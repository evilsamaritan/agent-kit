// Registry of native runtime formats. Adding a harness means adding one module here.
import { claude } from './claude.mjs'
import { codex } from './codex.mjs'
import { kimi } from './kimi.mjs'

export const runtimeRegistry = new Map([claude, codex, kimi].map((runtime) => [runtime.id, runtime]))
export const RUNTIMES = [...runtimeRegistry.keys()]
// Targets written when a project entry omits `runtimes`. Kimi is opt-in so an
// upgrade does not add a third agent directory to existing projects.
export const DEFAULT_RUNTIMES = ['claude', 'codex']
