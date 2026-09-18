#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = path.join(skillDir, 'assets')

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

function requirePattern(name, pattern, message) {
  if (!pattern.test(source[name])) failures.push(`${name}: ${message}`)
}

function idsIn(html) {
  return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1])
}

function checkUniqueIds(name) {
  const ids = idsIn(source[name])
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  for (const id of new Set(duplicates)) failures.push(`${name}: duplicate id ${id}`)
}

function checkLocalNavigation(name) {
  const ids = new Set(idsIn(source[name]))
  const targets = [...source[name].matchAll(/\bhref=["']#([^"']+)["']/g)].map(
    (match) => match[1],
  )
  for (const target of targets) {
    if (!ids.has(target)) failures.push(`${name}: navigation target #${target} does not exist`)
  }
}

for (const name of ['shell', 'preview']) {
  checkUniqueIds(name)
  checkLocalNavigation(name)

  for (const hook of [
    'data-viz-shell',
    'data-viz-navigation',
    'data-viz-menu',
    'data-viz-menu-toggle',
    'data-viz-menu-panel',
    'data-viz-menu-dismiss',
    'data-viz-nav',
    'data-viz-theme-value',
  ]) {
    requirePattern(name, new RegExp(`\\b${hook}(?:[=\\s>])`), `missing ${hook}`)
  }
}

const mermaidBlocks = [...source.preview.matchAll(
  /<div[^>]*\bdata-viz-mermaid\b[^>]*>[\s\S]*?<script\s+type=["']text\/plain["']>([\s\S]*?)<\/script>/g,
)].map((match) => match[1])

if (mermaidBlocks.length === 0) failures.push('preview: no Mermaid examples found')

const semanticClasses = new Set(['external', 'system', 'interface', 'domain', 'data', 'risk'])
mermaidBlocks.forEach((block, index) => {
  if (!/^\s*accTitle:\s*\S.+$/m.test(block)) {
    failures.push(`preview: Mermaid block ${index + 1} missing accTitle`)
  }
  if (!/^\s*accDescr:\s*\S.+$/m.test(block)) {
    failures.push(`preview: Mermaid block ${index + 1} missing accDescr`)
  }

  for (const match of block.matchAll(/^\s*class\s+\S+\s+(\S+)\s*$/gm)) {
    if (!semanticClasses.has(match[1])) {
      failures.push(`preview: Mermaid block ${index + 1} uses unsupported semantic class ${match[1]}`)
    }
  }
})

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

const canvasRule = source.css.match(/\.viz-canvas\s*\{([^}]*)\}/)?.[1] || ''
if (/overflow\s*:\s*auto/.test(canvasRule)) {
  failures.push('css: generic diagram canvas must not become a scroll container')
}

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

const panelRule = source.css.match(/\.viz-panel\s*\{([^}]*)\}/)?.[1] || ''
if (/overflow\s*:\s*hidden/.test(panelRule)) {
  failures.push('css: visual panel must clip without becoming a scroll container')
}

requirePattern('css', /html\s*\{[^}]*scrollbar-gutter:\s*stable/s, 'page scrollbar gutter is not stable')
requirePattern('css', /\.viz-shell\[data-viz-navigation="sidebar"\] \.viz-sidebar\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/s, 'desktop sidebar is not pinned independently of document height')
requirePattern('code', /data-viz-code/, 'optional code renderer has no code hook')
requirePattern('code', /highlight\.js@\d+\.\d+\.\d+/, 'code renderer dependency is not pinned')
requirePattern('diff', /data-viz-diff/, 'optional diff controller has no diff hook')
requirePattern('mermaid', /data-viz-mermaid/, 'optional Mermaid renderer has no diagram hook')
requirePattern('mermaid', /data-viz-mermaid-loading/, 'Mermaid renderer does not release loading state')
requirePattern('mermaid', /updateHorizontalScroll/, 'Mermaid renderer does not detect local horizontal overflow')
requirePattern('preview', /data-viz-code[^>]*data-viz-language=/, 'code example has no language contract')
requirePattern('preview', /visualization-code\.js/, 'code example does not load the optional renderer')

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(
  `Visualization shell contract OK: 2 documents, ${mermaidBlocks.length} Mermaid examples, navigation, scrolling, code/diff, IDs, hooks, and ownership boundaries checked.`,
)
