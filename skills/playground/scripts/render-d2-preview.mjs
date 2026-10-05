#!/usr/bin/env node
// Rebuild each D2 gallery model in both themes and presentation directions.
// Requires the D2 CLI. --check compares regenerated SVGs without changing assets.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets')
// The gallery SVGs are reproducible only with the pinned compiler and layout.
const D2_VERSION = '0.9.0'
const installed = execFileSync('d2', ['--version'], { encoding: 'utf8' }).trim().replace(/^v/, '')
if (installed !== D2_VERSION) {
  console.error(`D2 ${D2_VERSION} is pinned for the gallery (layout: elk); found ${installed}. Install the pinned version before rendering or checking.`)
  process.exit(1)
}
const models = ['model', 'system', 'dependencies', 'data-model', 'process', 'sequence', 'state', 'data-flow']
const css = fs.readFileSync(path.join(assets, 'visualization-shell.css'), 'utf8')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kit-d2-'))
const check = process.argv.includes('--check')
try {
  for (const theme of ['light', 'dark']) {
    const selector = theme === 'light' ? ':root' : ':root\\[data-viz-theme="dark"\\]'
    const block = css.match(new RegExp(`${selector}\\s*\\{([^}]+)`))?.[1]
    if (!block) throw new Error(`Missing ${theme} theme in the shared stylesheet`)
    const token = (name) => {
      const value = block.match(new RegExp(`--viz-${name}:\\s*([^;]+);`))?.[1]?.trim()
      if (!value) throw new Error(`Missing ${theme} token ${name}`)
      return value
    }
    const classes = ['system', 'interface', 'domain', 'data', 'external', 'risk'].map((role) =>
      `${role}: {style: {fill: "${token(`${role}-bg`)}"; stroke: "${token(`${role}-line`)}"; font-color: "${token('text')}"}}`,
    ).join('\n')
    const roleStyles = ['system', 'interface', 'domain', 'data', 'external', 'risk'].map((role) =>
      `***: {&class: ${role}; style: {fill: "${token(`${role}-bg`)}"; stroke: "${token(`${role}-line`)}"}}`,
    ).join('\n')
    const connectionStyle = ['->', '--', '<->', '<-'].map((arrow) => `
(*** ${arrow} ***)[*].style: {
  stroke: "${token('border-strong')}"
  stroke-width: 1
  font-size: 13
  font-color: "${token('text')}"
  bold: false
  italic: false
}`).join('\n')
    const style = `
vars: {
d2-config: {
theme-overrides: {
  N1: "${token('text')}"
  N2: "${token('text-muted')}"
  N3: "${token('border-strong')}"
  N4: "${token('border')}"
  N5: "${token('surface-subtle')}"
  N6: "${token('surface')}"
  N7: "${token('bg')}"
  B1: "${token('text')}"
  B2: "${token('text')}"
  B3: "${token('border-strong')}"
  B4: "${token('surface-raised')}"
  B5: "${token('surface-subtle')}"
  B6: "${token('surface')}"
  AA2: "${token('text-muted')}"
}
}
}
**.style: {
  fill: "${token('surface')}"
  stroke: "${token('border-strong')}"
  stroke-width: 1
  font-size: 13
  font-color: "${token('text')}"
  bold: false
  italic: false
}
classes: {
${classes}
}
${connectionStyle}
`
    for (const model of models) {
      const source = fs.readFileSync(path.join(assets, `_preview-${model}.d2`), 'utf8')
    for (const view of ['wide', 'compact']) {
      const name = `_preview-${model}.${theme}.${view}.svg`
      const output = path.join(temporary, name)
      execFileSync('d2', ['--layout=elk', `--theme=${theme === 'dark' ? 200 : 0}`, '--pad=16', '--scale=1', '--omit-version', '--no-xml-tag', '-', output], {
        input: `${style}${source}\n${roleStyles}\n***: {&shape: sql_table; style: {fill: "${token('surface-subtle')}"; stroke: "${token('surface')}"}}\n${model === 'sequence' ? '' : `direction: ${view === 'compact' || model === 'data-model' ? 'down' : 'right'}`}\n`,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      const svg = fs.readFileSync(output, 'utf8')
      const target = path.join(assets, name)
      if (check) {
        if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== svg) throw new Error(`${name} has drifted; run render-d2-preview.mjs with the project's D2 version`)
      } else fs.writeFileSync(target, svg)
    }
    }
  }
  console.log(`D2 preview ${check ? 'checked' : 'rendered'}: ${models.length} models, two themes, wide and compact.`)
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
