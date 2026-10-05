// Registry of native runtime formats. Adding a harness means adding one module here.
import { claude } from './claude.mjs'
import { codex } from './codex.mjs'

export const runtimeRegistry = new Map([claude, codex].map((runtime) => [runtime.id, runtime]))
export const RUNTIMES = [...runtimeRegistry.keys()]
