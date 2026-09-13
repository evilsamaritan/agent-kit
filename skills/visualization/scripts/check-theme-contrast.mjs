#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cssPath = path.join(skillDir, 'assets', 'visualization-shell.css')
const css = fs.readFileSync(cssPath, 'utf8')

function readBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
  if (!match) throw new Error(`Missing CSS block: ${selector}`)

  return Object.fromEntries(
    [...match[1].matchAll(/--viz-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((entry) => [
      entry[1],
      entry[2].toLowerCase(),
    ]),
  )
}

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(left, right) {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

const themes = {
  light: readBlock(':root'),
  dark: readBlock(':root[data-viz-theme="dark"]'),
}
const automaticDark = readBlock(':root[data-viz-theme="auto"]')

const checks = [
  ['text', 'surface', 4.5],
  ['text-muted', 'surface', 4.5],
  ['accent', 'surface', 4.5],
  ['focus', 'surface', 3],
  ['border-strong', 'surface', 3],
  ['system-line', 'system-bg', 3],
  ['interface-line', 'interface-bg', 3],
  ['domain-line', 'domain-bg', 3],
  ['data-line', 'data-bg', 3],
  ['external-line', 'external-bg', 3],
  ['risk-line', 'risk-bg', 3],
  ['interface-line', 'surface-subtle', 4.5],
  ['domain-line', 'surface-subtle', 4.5],
  ['domain-line', 'domain-bg', 4.5],
  ['risk-line', 'risk-bg', 4.5],
]

const failures = []

for (const [themeName, tokens] of Object.entries(themes)) {
  for (const [foregroundName, backgroundName, minimum] of checks) {
    const foreground = tokens[foregroundName]
    const background = tokens[backgroundName]

    if (!foreground || !background) {
      failures.push(`${themeName}: missing ${foregroundName} or ${backgroundName}`)
      continue
    }

    const ratio = contrast(foreground, background)
    if (ratio < minimum) {
      failures.push(
        `${themeName}: ${foregroundName}/${backgroundName} ${ratio.toFixed(2)}:1 < ${minimum}:1`,
      )
    }
  }
}

for (const [token, value] of Object.entries(themes.dark)) {
  if (automaticDark[token] !== value) {
    failures.push(`auto dark: ${token} differs from explicit dark`)
  }
}

for (const token of Object.keys(automaticDark)) {
  if (!(token in themes.dark)) failures.push(`auto dark: unexpected token ${token}`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(
  `Visualization theme contrast OK: ${checks.length * 2} pairs checked; dark token parity verified.`,
)
