/** Bounded, lossless TOML editor. Unsupported input holds repair instead of guessing. */
export class PolicyTomlError extends Error {
  constructor(readonly detail: string) { super(detail); this.name = "PolicyTomlError" }
}
interface Assignment { readonly path: readonly string[]; readonly start: number; readonly end: number; readonly value: string }
export interface PolicyToml { readonly source: string; readonly assignments: readonly Assignment[]; readonly firstTable: number; readonly tables: readonly { readonly path: readonly string[]; readonly start: number; readonly end: number }[] }
function keys(text: string): readonly string[] {
  const result: string[] = []
  let cursor = 0
  while (cursor < text.length) {
    const match = /^[ \t]*(?:"([^"\\\r\n]*)"|'([^'\r\n]*)'|([A-Za-z0-9_-]+))[ \t]*/u.exec(text.slice(cursor))
    if (match === null) throw new PolicyTomlError("Unsupported TOML key")
    result.push(match[1] ?? match[2] ?? match[3] ?? "")
    cursor += match[0].length
    if (cursor === text.length) break
    if (text[cursor] !== ".") throw new PolicyTomlError("Invalid TOML key")
    cursor += 1
    if (cursor === text.length) throw new PolicyTomlError("Trailing TOML key separator")
  }
  if (result.length === 0) throw new PolicyTomlError("Empty TOML key")
  return result
}
export function scanPolicyToml(source: string): PolicyToml {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source) || /\r(?!\n)/u.test(source)) throw new PolicyTomlError("Invalid raw TOML control character")
  const assignments: Assignment[] = []; const seen = new Set<string>(); const tables = new Set<string>()
  const sections: { path: readonly string[]; start: number }[] = []
  let table: readonly string[] = []; let cursor = 0; let firstTable = source.length
  while (cursor < source.length) {
    while (/[ \t\r\n]/u.test(source[cursor] ?? "") && cursor < source.length) cursor += 1
    if (cursor >= source.length) break
    if (source[cursor] === "#") { cursor = source.indexOf("\n", cursor); if (cursor < 0) break; continue }
    const lineStart = cursor
    if (source[cursor] === "[") {
      const end = source.indexOf("\n", cursor); const line = source.slice(cursor, end < 0 ? source.length : end)
      const match = /^\[([^\[\]]+)\][ \t\r]*(?:#.*)?$/u.exec(line)
      if (match?.[1] === undefined) throw new PolicyTomlError("Unsupported TOML table")
      table = keys(match[1]); const id = JSON.stringify(table)
      if (tables.has(id)) throw new PolicyTomlError("Duplicate TOML table")
      tables.add(id); sections.push({ path: table, start: lineStart }); firstTable = Math.min(firstTable, lineStart); cursor = end < 0 ? source.length : end + 1; continue
    }
    let equals = cursor; let keyQuote = ""
    for (; equals < source.length; equals += 1) {
      const char = source[equals]
      if (keyQuote !== "") { if (char === keyQuote) keyQuote = ""; continue }
      if (char === '"' || char === "'") { keyQuote = char; continue }
      if (char === "=" || char === "\n") break
    }
    if (source[equals] !== "=") throw new PolicyTomlError("Invalid TOML assignment")
    const assignmentKeys = keys(source.slice(cursor, equals))
    if (assignmentKeys.length !== 1) throw new PolicyTomlError("Unsupported dotted TOML assignment")
    const path = [...table, ...assignmentKeys]; const id = JSON.stringify(path)
    if (seen.has(id)) throw new PolicyTomlError("Duplicate TOML assignment")
    seen.add(id); cursor = equals + 1
    while (source[cursor] === " " || source[cursor] === "\t") cursor += 1
    const start = cursor; let quote = ""; let triple = false; let depth = 0; let quotedComplete = false
    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor]
      if (quote !== "") {
        if (quote === '"' && char === "\\") {
          const escaped = source[cursor + 1]
          if (escaped === "u" || escaped === "U") {
            const length = escaped === "u" ? 4 : 8; const code = source.slice(cursor + 2, cursor + 2 + length); const point = Number.parseInt(code, 16)
            if (code.length !== length || !/^[A-Fa-f0-9]+$/u.test(code) || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) throw new PolicyTomlError("Invalid TOML Unicode scalar escape")
          }
          cursor += 1; continue
        }
        if (triple && source.slice(cursor, cursor + 3) === quote.repeat(3)) { cursor += 2; quote = ""; triple = false; quotedComplete = depth === 0; continue }
        if (!triple && char === quote) { quote = ""; quotedComplete = depth === 0; continue }
        if (!triple && char === "\n") throw new PolicyTomlError("Unterminated TOML string")
        continue
      }
      if (quotedComplete) {
        if (char === "#" || char === "\n") break
        if (char === " " || char === "\t" || char === "\r") continue
        throw new PolicyTomlError("Trailing token after TOML string")
      }
      if (char === '"' || char === "'") { quote = char; triple = source.slice(cursor, cursor + 3) === char.repeat(3); if (triple) cursor += 2; continue }
      if (char === "[" || char === "{") depth += 1
      if (char === "]" || char === "}") depth -= 1
      if (depth < 0) throw new PolicyTomlError("Invalid TOML value")
      if (char === "#") { const end = source.indexOf("\n", cursor); if (depth === 0) break; cursor = end < 0 ? source.length : end; continue }
      if (char === "\n" && depth === 0) break
    }
    if (quote !== "" || depth !== 0) throw new PolicyTomlError("Unterminated TOML value")
    const raw = source.slice(start, cursor).replace(/[ \t\r]+$/u, ""); const end = start + raw.length
    if (raw.length === 0) throw new PolicyTomlError("Empty TOML value")
    const scalarString = /^(?:"(?:[^"\\\r\n]|\\[btnfr"\\]|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*"|'[^'\r\n]*')$/u.test(raw)
    const multilineString = ['"""', "'''"].some((delimiter) => raw.startsWith(delimiter) && raw.endsWith(delimiter))
    const composite = (raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))
    const scalar = /^(?:true|false|[+-]?(?:inf|nan)|[+-]?(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?|0x[A-Fa-f0-9](?:_?[A-Fa-f0-9])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*)$/u.test(raw)
    if (raw.startsWith('"')) {
      const body = raw.startsWith('"""') ? raw.slice(3, -3) : raw.slice(1, -1)
      for (let index = 0; index < body.length; index += 1) {
        if (body[index] !== "\\") continue
        const escaped = body[index + 1]
        if (escaped === undefined) throw new PolicyTomlError("Invalid TOML escape")
        if (["b", "t", "n", "f", "r", '"', "\\"].includes(escaped)) { index += 1; continue }
        if (escaped === "u" || escaped === "U") {
          const length = escaped === "u" ? 4 : 8; const code = body.slice(index + 2, index + 2 + length)
          const point = Number.parseInt(code, 16)
          if (code.length !== length || !/^[A-Fa-f0-9]+$/u.test(code) || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) throw new PolicyTomlError("Invalid TOML Unicode escape")
          index += 1 + length; continue
        }
        if (raw.startsWith('"""') && /[ \t\r\n]/u.test(escaped)) {
          let end = index + 1; while (/[ \t\r\n]/u.test(body[end] ?? "") && end < body.length) end += 1
          if (!body.slice(index + 1, end).includes("\n")) throw new PolicyTomlError("Invalid TOML continuation")
          index = end - 1; continue
        }
        throw new PolicyTomlError("Unsupported TOML escape")
      }
    }

    // Only string arrays are supported; other compound values hold the whole operation.
    const stringArray = /^\[[ \t\r\n]*(?:(?:"(?:[^"\\\r\n]|\\[btnfr"\\]|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*"|'[^'\r\n]*')[ \t\r\n]*(?:,[ \t\r\n]*(?:"(?:[^"\\\r\n]|\\[btnfr"\\]|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*"|'[^'\r\n]*')[ \t\r\n]*)*,?[ \t\r\n]*)?\]$/u.test(raw)
    if (composite && !stringArray) throw new PolicyTomlError("Unsupported compound TOML value")
    if (!scalarString && !multilineString && !scalar && !stringArray) throw new PolicyTomlError("Invalid or unsupported TOML value")
    assignments.push({ path, start, end, value: raw })
    if (source[cursor] === "#") { const endLine = source.indexOf("\n", cursor); cursor = endLine < 0 ? source.length : endLine }
    cursor += 1
  }
  // Table/leaf collisions are invalid even if their textual spellings differ.
  for (const assignment of assignments) for (const other of assignments) {
    if (assignment.path.length < other.path.length && assignment.path.every((key, index) => key === other.path[index])) throw new PolicyTomlError("Conflicting TOML keys")
  }
  for (const assignment of assignments) for (const id of tables) {
    const tablePath: unknown = JSON.parse(id)
    if (Array.isArray(tablePath) && assignment.path.length <= tablePath.length && assignment.path.every((key, index) => key === tablePath[index])) throw new PolicyTomlError("Conflicting TOML table and scalar")
  }
  return { source, assignments, firstTable, tables: sections.map((section, index) => ({ ...section, end: sections[index + 1]?.start ?? source.length })) }
}
export function policyTomlString(document: PolicyToml, key: string): string | undefined {
  const assignment = document.assignments.find((entry) => entry.path.length === 1 && entry.path[0] === key)
  if (assignment === undefined) return undefined
  if (/^"[^"\\\n]*"$/u.test(assignment.value) || /^'[^'\n]*'$/u.test(assignment.value)) return assignment.value.slice(1, -1)
  throw new PolicyTomlError(`Unsupported scalar policy value: ${key}`)
}
export function editPolicyToml(source: string, values: Readonly<Record<string, string>>): string {
  const document = scanPolicyToml(source); const edits: { start: number; end: number; text: string }[] = []; const missing: string[] = []
  for (const [key, value] of Object.entries(values)) {
    policyTomlString(document, key)
    const assignment = document.assignments.find((entry) => entry.path.length === 1 && entry.path[0] === key)
    if (assignment === undefined) missing.push(`${key} = ${JSON.stringify(value)}\n`)
    else edits.push({ start: assignment.start, end: assignment.end, text: JSON.stringify(value) })
  }
  if (missing.length > 0) edits.push({ start: document.firstTable, end: document.firstTable, text: `${document.firstTable > 0 && source[document.firstTable - 1] !== "\n" ? "\n" : ""}${missing.join("")}` })
  return edits.sort((left, right) => right.start - left.start).reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source)
}
export function withoutPolicySettings(source: string): string {
  const document = scanPolicyToml(source)
  return document.assignments.filter((entry) => entry.path.length === 1 && ["model", "model_reasoning_effort", "service_tier"].includes(entry.path[0] ?? "")).sort((left, right) => right.start - left.start).reduce((text, entry) => text.slice(0, entry.start) + "<setting>" + text.slice(entry.end), source)
}

export function removePolicyTomlTable(source: string, path: readonly string[]): string {
  const document = scanPolicyToml(source)
  const section = document.tables.find((entry) => JSON.stringify(entry.path) === JSON.stringify(path))
  if (section === undefined) return source
  return source.slice(0, section.start) + source.slice(section.end)
}
