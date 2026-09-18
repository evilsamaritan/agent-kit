#!/usr/bin/env node

// Usage:
//   node scripts/check-shell-contract.mjs                 check the skill's own assets and docs
//   node scripts/check-shell-contract.mjs <artifact.html>  also check produced artifacts

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = path.join(skillDir, 'assets')
const componentsDoc = path.join(skillDir, 'references', 'shell-components.md')

const files = {
  shell: path.join(assetsDir, 'visualization-shell.html'),
  preview: path.join(assetsDir, '_preview.html'),
  css: path.join(assetsDir, 'visualization-shell.css'),
  runtime: path.join(assetsDir, 'visualization-shell.js'),
  code: path.join(assetsDir, 'visualization-code.js'),
  diff: path.join(assetsDir, 'visualization-diff.js'),
  mermaid: path.join(assetsDir, 'visualization-mermaid.js'),
}

const source = Object.fromEntries(
  Object.entries(files).map(([name, file]) => [name, fs.readFileSync(file, 'utf8')]),
)
const failures = []
const warnings = []

const shellHooks = [
  'data-viz-shell',
  'data-viz-navigation',
  'data-viz-menu',
  'data-viz-menu-toggle',
  'data-viz-menu-panel',
  'data-viz-menu-dismiss',
  'data-viz-nav',
  'data-viz-theme-value',
]
const semanticClasses = new Set(['external', 'system', 'interface', 'domain', 'data', 'risk'])
// A larger inline script is a vendored library, which legitimately contains wheel/touch listeners.
const MAX_AUTHORED_SCRIPT_CHARS = 20_000

// Comments may mention hooks, ids, and classes; only real markup counts.
function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

function vizClassesIn(html) {
  const classes = new Set()
  for (const [, value] of stripComments(html).matchAll(/\bclass=["']([^"']+)["']/g)) {
    for (const cls of value.split(/\s+/)) if (cls.startsWith('viz-')) classes.add(cls)
  }
  return classes
}

// The vocabulary is what the stylesheet defines plus hook-only classes used by the canonical documents.
const cssClasses = new Set([
  ...[...source.css.matchAll(/\.(viz-[a-z0-9_-]+)/g)].map((match) => match[1]),
  ...vizClassesIn(source.shell),
  ...vizClassesIn(source.preview),
])
// Classes set by the runtime or used only inside generated markup; not part of the authoring vocabulary.
const internalBlocks = new Set(['viz-menu-open', 'viz-theme-icon'])

function requirePattern(name, pattern, message) {
  if (!pattern.test(source[name])) failures.push(`${name}: ${message}`)
}

function idsIn(html) {
  return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1])
}

function mermaidBlocksIn(html) {
  return [...html.matchAll(
    /<div[^>]*\bdata-viz-mermaid\b[^>]*>[\s\S]*?<script\s+type=["']text\/plain["']>([\s\S]*?)<\/script>/g,
  )].map((match) => match[1])
}

function revisionOf(text) {
  return text.match(/data-viz-shell-revision=["'](\d+)["']/)?.[1]
    ?? text.match(/visualization-shell revision (\d+)/)?.[1]
    ?? null
}

// Checks shared by the canonical documents and by produced artifacts.
function checkDocument(name, rawHtml) {
  const html = stripComments(rawHtml)
  const known = new Set()
  const duplicates = new Set()
  for (const id of idsIn(html)) (known.has(id) ? duplicates : known).add(id)
  for (const id of duplicates) failures.push(`${name}: duplicate id ${id}`)
  for (const [, target] of html.matchAll(/\bhref=["']#([^"']+)["']/g)) {
    if (!known.has(target)) failures.push(`${name}: navigation target #${target} does not exist`)
  }
  for (const hook of shellHooks) {
    if (!new RegExp(`<[a-zA-Z][^>]*\\s${hook}(?=[=\\s>/])`).test(html)) failures.push(`${name}: missing ${hook}`)
  }

  const blocks = mermaidBlocksIn(html)
  blocks.forEach((block, index) => {
    if (!/^\s*accTitle:\s*\S.+$/m.test(block)) failures.push(`${name}: Mermaid block ${index + 1} missing accTitle`)
    if (!/^\s*accDescr:\s*\S.+$/m.test(block)) failures.push(`${name}: Mermaid block ${index + 1} missing accDescr`)
    for (const match of block.matchAll(/^\s*class\s+\S+\s+(\S+)\s*$/gm)) {
      if (!semanticClasses.has(match[1])) {
        failures.push(`${name}: Mermaid block ${index + 1} uses unsupported semantic class ${match[1]}`)
      }
    }
  })
  if (blocks.length > 0) {
    if (!/<html[^>]*\bdata-viz-mermaid-loading\b/.test(html)) {
      failures.push(`${name}: renders Mermaid but <html> has no data-viz-mermaid-loading gate`)
    }
    if (!/history\.scrollRestoration\s*=\s*["']manual["']/.test(html)) {
      failures.push(`${name}: renders Mermaid but does not set history.scrollRestoration = "manual"`)
    }
  }

  for (const [tag] of html.matchAll(/<[^>]*\bdata-viz-code\b[^>]*>/g)) {
    if (!/\bdata-viz-language=/.test(tag)) failures.push(`${name}: code region has no data-viz-language`)
  }
  return blocks.length
}

// Checks that apply only to a produced artifact.
function checkArtifact(file) {
  const name = path.basename(file)
  const html = fs.readFileSync(file, 'utf8')
  checkDocument(name, html)

  for (const cls of vizClassesIn(html)) {
    if (!cssClasses.has(cls)) {
      failures.push(`${name}: class ${cls} is not part of the shell; use a documented component (references/shell-components.md) or a task-specific prefix`)
    }
  }

  // Inline scripts only: bundled library code legitimately contains such listeners.
  for (const [, script] of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*text\/plain)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (script.length < MAX_AUTHORED_SCRIPT_CHARS && /addEventListener\(\s*["'](?:wheel|mousewheel|touchmove)["']/.test(script)) {
      failures.push(`${name}: an inline script intercepts wheel/touch scrolling`)
    }
  }

  const current = revisionOf(source.shell)
  const built = revisionOf(html)
  if (!built) warnings.push(`${name}: no data-viz-shell-revision; cannot tell which shell copy it was built from`)
  else if (built !== current) warnings.push(`${name}: built from shell revision ${built}; current is ${current} — re-copy the shell assets`)
}

// --- the skill's own assets ------------------------------------------------

const mermaidInShell = checkDocument('shell', source.shell)
const mermaidInPreview = checkDocument('preview', source.preview)
if (mermaidInPreview === 0) failures.push('preview: no Mermaid examples found')
const mermaidExamples = mermaidInShell + mermaidInPreview

const revisions = new Set(Object.values(source).map(revisionOf))
if (revisions.size !== 1 || revisions.has(null)) {
  failures.push(`assets: shell revision stamps disagree or are missing: ${[...revisions].join(', ')}`)
}

for (const legacy of ['viz-flow__edge', 'viz-decision', 'viz-deployment__edge']) {
  if (source.css.includes(legacy) || source.preview.includes(legacy) || source.shell.includes(legacy)) {
    failures.push(`shell: legacy connector implementation remains: ${legacy}`)
  }
}

if (/data-viz-diff|viz-diff-mode/.test(source.runtime)) {
  failures.push('runtime: diff behavior must stay in visualization-diff.js')
}

if (/data-viz-code|viz-code-status/.test(source.runtime)) {
  failures.push('runtime: code highlighting must stay in visualization-code.js')
}

// Every rule for the selector counts, including the ones inside media and container queries.
function forbidInRule(selector, forbidden, message) {
  for (const [, body] of source.css.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'g'))) {
    if (forbidden.test(body)) failures.push(message)
  }
}

forbidInRule('viz-canvas', /overflow(?:-[xy])?\s*:\s*(?:auto|scroll)/, 'css: generic diagram canvas must not become a scroll container')

// Content regions may contain horizontal overscroll only. The two-axis shorthand,
// a vertical overscroll boundary, or a restrictive touch-action on a diagram or
// code region stops wheel/touch gestures from reaching the document.
const modalSurface = /viz-menu-open|\.viz-nav\b/
const panZoomSurface = /\[data-viz-pan-zoom/
for (const [, selector, body] of source.css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const name = selector.trim().replace(/\s+/g, ' ')
  if (/overscroll-behavior(?:-y|-block)?\s*:/.test(body) && !modalSurface.test(name)) {
    failures.push(`css: ${name} blocks vertical scroll chaining; use overscroll-behavior-x on content regions`)
  }
  const touch = body.match(/touch-action\s*:\s*([^;]+)/)?.[1].trim()
  if (touch && !/^(auto|manipulation)$/.test(touch) && !panZoomSurface.test(name)) {
    failures.push(`css: ${name} restricts touch gestures (${touch}) outside an explicit pan/zoom mode`)
  }
}

for (const name of ['runtime', 'code', 'diff', 'mermaid']) {
  if (/addEventListener\(\s*["'](?:wheel|mousewheel|touchmove)["']/.test(source[name])) {
    failures.push(`${name}: must not intercept wheel/touch scrolling; fix the CSS scroll chain instead`)
  }
}

forbidInRule('viz-panel', /overflow\s*:\s*hidden/, 'css: visual panel must clip without becoming a scroll container')

requirePattern('css', /html\s*\{[^}]*scrollbar-gutter:\s*stable/s, 'page scrollbar gutter is not stable')
requirePattern('css', /\.viz-shell\[data-viz-navigation="sidebar"\] \.viz-sidebar\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/s, 'desktop sidebar is not pinned independently of document height')
requirePattern('code', /data-viz-code/, 'optional code renderer has no code hook')
requirePattern('code', /highlight\.js@\d+\.\d+\.\d+/, 'code renderer dependency is not pinned')
requirePattern('diff', /data-viz-diff/, 'optional diff controller has no diff hook')
requirePattern('mermaid', /data-viz-mermaid/, 'optional Mermaid renderer has no diagram hook')
requirePattern('mermaid', /data-viz-mermaid-loading/, 'Mermaid renderer does not release loading state')
requirePattern('mermaid', /dataset\.vizHorizontalScroll\s*=/, 'Mermaid renderer does not flag local horizontal overflow')
requirePattern('mermaid', /MAX_FIT_OVERFLOW\s*=\s*1\.(0\d|1\d)\b/, 'Mermaid renderer may shrink labels below reading size; keep the fit limit under 1.2')
requirePattern('preview', /data-viz-code[^>]*data-viz-language=/, 'code example has no language contract')
requirePattern('preview', /visualization-code\.js/, 'code example does not load the optional renderer')

// The component reference and the stylesheet must describe the same vocabulary.
if (fs.existsSync(componentsDoc)) {
  const doc = fs.readFileSync(componentsDoc, 'utf8')
  // Class names only: `data-viz-*` hooks are attributes, not classes.
  const documented = new Set([...doc.matchAll(/(?<![\w-])(viz-[a-z0-9_-]+)/g)].map((match) => match[1]))
  for (const cls of documented) {
    if (!cssClasses.has(cls)) failures.push(`shell-components.md: documents ${cls}, which the stylesheet does not define`)
  }
  if (revisionOf(doc) !== revisionOf(source.shell)) {
    failures.push('shell-components.md: page skeleton shows a different data-viz-shell-revision than the shell')
  }
  const documentedBlocks = new Set([...documented].map((cls) => cls.split(/__|--/)[0]))
  const blocks = new Set([...cssClasses].map((cls) => cls.split(/__|--/)[0]))
  for (const block of blocks) {
    if (!documentedBlocks.has(block) && !internalBlocks.has(block)) {
      failures.push(`shell-components.md: stylesheet block ${block} is undocumented`)
    }
  }
} else {
  failures.push('references/shell-components.md is missing')
}

// --- produced artifacts ------------------------------------------------------

const artifacts = process.argv.slice(2)
for (const file of artifacts) {
  if (!fs.existsSync(file)) failures.push(`${file}: file not found`)
  else checkArtifact(file)
}

for (const warning of warnings) console.warn(`warning: ${warning}`)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(
  `Visualization shell contract OK: 2 canonical documents, ${mermaidExamples} Mermaid examples, ${artifacts.length} artifact(s); navigation, scrolling, code/diff, IDs, hooks, revisions, and component vocabulary checked.`,
)
