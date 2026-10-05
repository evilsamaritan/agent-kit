// The source schema deliberately uses flat scalars and inline arrays.
// Normalize YAML and JSON to the same types before runtime field validation.
function scalar(raw) {
  if (raw.startsWith('"')) return JSON.parse(raw)
  if (raw.startsWith("'")) {
    if (!raw.endsWith("'")) throw new Error('unterminated quoted scalar')
    return raw.slice(1, -1).replace(/''/g, "'")
  }
  if (raw === 'true' || raw === 'false') return raw === 'true'
  if (raw === 'null') return null
  if (/^-?\d+$/.test(raw)) return Number(raw)
  return raw
}

export function parseFlatYaml(text, origin, issues = []) {
  const out = {}
  text.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trimEnd()
    if (!line || line.trimStart().startsWith('#')) return
    try {
      const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/.exec(line)
      if (!match) throw new Error('expected a flat scalar or inline array')
      const [, key, raw] = match
      if (Object.hasOwn(out, key)) throw new Error(`duplicate field ${key}`)
      if (raw === '|' || raw === '>') throw new Error(`${key} must be a single-line value`)
      if (raw.startsWith('[')) {
        if (!raw.endsWith(']')) throw new Error(`unterminated array ${key}`)
        // Quoted strings may contain commas. Match only scalar list items.
        const inner = raw.slice(1, -1).trim()
        const items = inner ? inner.match(/"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[^,]+/g) : []
        out[key] = items.map((item) => scalar(item.trim()))
      } else out[key] = scalar(raw)
    } catch (error) { issues.push(`${origin}:${index + 1}: ${error.message}`) }
  })
  return out
}

export function splitFrontmatter(text, origin, issues) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!match) {
    issues.push(`${origin}: missing YAML frontmatter delimiters`)
    return { front: {}, body: '' }
  }
  return { front: parseFlatYaml(match[1], origin, issues), body: text.slice(match[0].length).replace(/^\n+/, '') }
}
