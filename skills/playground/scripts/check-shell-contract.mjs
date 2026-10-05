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
  page: path.join(assetsDir, 'visualization-page.html'),
  preview: path.join(assetsDir, '_preview.html'),
  css: path.join(assetsDir, 'visualization-shell.css'),
  runtime: path.join(assetsDir, 'visualization-shell.js'),
  code: path.join(assetsDir, 'visualization-code.js'),
  diff: path.join(assetsDir, 'visualization-diff.js'),
  mermaid: path.join(assetsDir, 'visualization-mermaid.js'),
  diagram: path.join(assetsDir, 'visualization-diagram.js'),
}

const source = Object.fromEntries(
  Object.entries(files).map(([name, file]) => [name, fs.readFileSync(file, 'utf8')]),
)
const failures = []
const warnings = []

// The explorer shell contract applies only to pages that use the explorer shell.
const explorerHooks = [
  'data-viz-shell',
  'data-viz-navigation',
  'data-viz-menu',
  'data-viz-menu-toggle',
  'data-viz-menu-panel',
  'data-viz-menu-dismiss',
  'data-viz-nav',
  'data-viz-theme-value',
]
const hasHook = (html, hook) => new RegExp(`<[a-zA-Z][^>]*\\s${hook}(?=[=\\s>/])`).test(html)
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
  ...vizClassesIn(source.page),
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

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`))?.[1]
}

function compiledBlocksIn(html) {
  return [...html.matchAll(/<figure\b([^>]*\bdata-viz-diagram(?=[=\s>/])[^>]*)>([\s\S]*?)<\/figure>/g)]
}

function checkLocalFile(name, url, file, svg = false) {
  if (svg && /^data:image\/svg\+xml[;,]/.test(url)) return
  if (/^(?:https?:|\/\/)/.test(url) && !svg) return // An authoritative source may be linked remotely.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) {
    failures.push(`${name}: compiled SVG must be local or embedded: ${url}`)
    return
  }
  let local
  try {
    local = path.resolve(path.dirname(file), decodeURIComponent(url.split(/[?#]/)[0]))
  } catch {
    failures.push(`${name}: invalid local asset path ${url}`)
    return
  }
  if (!fs.existsSync(local) || !fs.statSync(local).isFile()) {
    failures.push(`${name}: diagram asset not found: ${url}`)
  } else if (svg && (!/\.svg$/i.test(local) || !/<svg\b[^>]*\bviewBox=/.test(fs.readFileSync(local, 'utf8')))) {
    failures.push(`${name}: diagram asset is not an SVG with a viewBox: ${url}`)
  }
}

function checkCompiled(name, html, known, file) {
  const blocks = compiledBlocksIn(html)
  const hooks = [...html.matchAll(/<[a-zA-Z][^>]*\sdata-viz-diagram(?=[=\s>/])/g)].length
  if (hooks !== blocks.length) failures.push(`${name}: data-viz-diagram must be on a complete figure`)
  for (const [index, [, tag, body]] of blocks.entries()) {
    const label = `${name}: compiled diagram ${index + 1}`
    const format = attribute(tag, 'data-viz-diagram')
    if (!['mermaid', 'd2', 'plantuml', 'graphviz'].includes(format)) failures.push(`${label} has unsupported source format ${format}`)
    for (const attr of ['aria-labelledby', 'aria-describedby']) {
      const ids = attribute(tag, attr)?.trim().split(/\s+/)
      if (!ids?.length || ids.some((id) => !known.has(id))) failures.push(`${label} has missing or unresolved ${attr}`)
    }
    const breakpoint = attribute(tag, 'data-viz-compact-at')
    if (breakpoint !== undefined && !(Number(breakpoint) > 0)) failures.push(`${label} has invalid compact breakpoint`)
    if (!/\bdata-viz-diagram-output(?=[=\s>/])/.test(body)) failures.push(`${label} has no output hook`)
    const sourceTag = body.match(/<a\b[^>]*\bdata-viz-diagram-source(?=[=\s>/])[^>]*>/)?.[0]
    const sourceUrl = sourceTag && attribute(sourceTag, 'href')
    if (!sourceUrl) failures.push(`${label} has no editable source link`)
    else {
      const extensions = { mermaid: /\.(?:mmd|mermaid)$/, d2: /\.d2$/, plantuml: /\.(?:puml|pu)$/, graphviz: /\.(?:dot|gv)$/ }
      if (!/^(?:https?:|\/\/)/.test(sourceUrl) && extensions[format] && !extensions[format].test(sourceUrl.split(/[?#]/)[0])) {
        failures.push(`${label} source extension does not match ${format}`)
      }
      if (file) checkLocalFile(label, sourceUrl, file)
    }
    const pairs = new Set()
    for (const [image] of body.matchAll(/<img\b[^>]*>/g)) {
      const theme = attribute(image, 'data-viz-diagram-theme')
      const view = attribute(image, 'data-viz-diagram-view') || 'wide'
      if (!['light', 'dark'].includes(theme) || !['wide', 'compact'].includes(view)) failures.push(`${label} has an invalid image theme/view`)
      const pair = `${theme}/${view}`
      if (pairs.has(pair)) failures.push(`${label} duplicates ${pair}`)
      pairs.add(pair)
      if (!attribute(image, 'alt')?.trim()) failures.push(`${label} has no image alt text`)
      if (!(Number(attribute(image, 'width')) > 0 && Number(attribute(image, 'height')) > 0)) failures.push(`${label} needs natural image dimensions`)
      const url = attribute(image, 'src')
      if (!url) failures.push(`${label} has no SVG image source`)
      else if (file) checkLocalFile(label, url, file, true)
    }
    for (const view of ['wide', ...(pairs.has('light/compact') || pairs.has('dark/compact') ? ['compact'] : [])]) {
      for (const theme of ['light', 'dark']) if (!pairs.has(`${theme}/${view}`)) failures.push(`${label} is missing ${theme}/${view}`)
    }
  }
  if (blocks.length && !/visualization-diagram\.js|querySelectorAll\(["']\[data-viz-diagram\]["']\)/.test(html)) {
    failures.push(`${name}: compiled diagrams do not load visualization-diagram.js or its inline runtime`)
  }
  return blocks.length
}

function revisionOf(text) {
  return text.match(/data-viz-shell-revision=["'](\d+)["']/)?.[1]
    ?? text.match(/visualization-shell revision (\d+)/)?.[1]
    ?? null
}

// Checks shared by the canonical documents and by produced artifacts.
function checkDocument(name, rawHtml, file) {
  const html = stripComments(rawHtml)
  const known = new Set()
  const duplicates = new Set()
  for (const id of idsIn(html)) (known.has(id) ? duplicates : known).add(id)
  for (const id of duplicates) failures.push(`${name}: duplicate id ${id}`)
  for (const [, target] of html.matchAll(/\bhref=["']#([^"']+)["']/g)) {
    if (!known.has(target)) failures.push(`${name}: navigation target #${target} does not exist`)
  }
  const explorer = hasHook(html, 'data-viz-shell')
  if (explorer) {
    for (const hook of explorerHooks) if (!hasHook(html, hook)) failures.push(`${name}: explorer shell is missing ${hook}`)
  } else if (/visualization-shell\.css|\bclass=["'][^"']*\bviz-/.test(html) && !hasHook(html, 'data-viz-theme-value')) {
    failures.push(`${name}: uses the shared visual system without the shared theme control (data-viz-theme-value)`)
  }
  if (!/visualization-shell\.css|prefers-color-scheme|data-viz-theme|color-scheme/.test(rawHtml)) {
    failures.push(`${name}: no light/dark theme support found`)
  }

  checkCompiled(name, html, known, file)

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
  checkDocument(name, html, file)

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
  if (!built) {
    if (/visualization-shell\.(?:css|js)/.test(html)) warnings.push(`${name}: no data-viz-shell-revision; cannot tell which asset copy it was built from`)
  } else if (built !== current) warnings.push(`${name}: built from shell revision ${built}; current is ${current} — re-copy the shell assets`)
}

// --- the skill's own assets ------------------------------------------------

const mermaidInShell = checkDocument('shell', source.shell, files.shell)
checkDocument('page', source.page, files.page)
const mermaidInPreview = checkDocument('preview', source.preview, files.preview)
if (mermaidInPreview === 0) failures.push('preview: no Mermaid examples found')
if (!compiledBlocksIn(source.preview).some(([, tag]) => attribute(tag, 'data-viz-diagram') === 'd2')) failures.push('preview: no compiled D2 example found')
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

for (const name of ['runtime', 'code', 'diff', 'mermaid', 'diagram']) {
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
requirePattern('diagram', /data-viz-diagram/, 'compiled SVG adapter has no diagram hook')
requirePattern('diagram', /dataset\.vizHorizontalScroll\s*=/, 'compiled SVG adapter does not flag local horizontal overflow')
requirePattern('diagram', /MAX_FIT_OVERFLOW\s*=\s*1\.(0\d|1\d)\b/, 'compiled SVG adapter may shrink labels below reading size; keep the fit limit under 1.2')
requirePattern('diagram', /dataset\.vizTheme/, 'compiled SVG adapter does not follow the shell theme')
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
  `Playground contract OK: 3 canonical documents, ${mermaidExamples} Mermaid examples, ${compiledBlocksIn(source.preview).length} compiled example(s), ${artifacts.length} artifact(s); navigation, scrolling, code/diff, source assets, theme/view pairs, IDs, hooks, revisions, and component vocabulary checked.`,
)
