import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join } from "node:path"
import { GOOGLE_STITCH_ADAPTER } from "./mcp-adapters.js"

type DesignSectionName = (typeof GOOGLE_STITCH_ADAPTER.designSections)[number]

export type DesignMdValidationResult = { valid: boolean; errors: string[] }

const DESIGN_SECTION_CONTENT: Record<DesignSectionName, string[]> = {
  Overview: ["Capture the product, audience, and intended experience in 2-4 sentences."],
  Colors: [
    "Primary: TODO define the main brand color and usage.",
    "Secondary: TODO define the supporting accent color and usage.",
    "Tertiary: TODO define the optional highlight color and usage.",
    "Neutral: TODO define the neutral palette and surfaces.",
  ],
  Typography: ["Define font families, sizes, weights, and usage rules before design generation."],
  Elevation: ["Describe shadows, borders, radii, and layering rules."],
  Components: ["List priority components, states, and reusable interaction patterns."],
  "Do's and Don'ts": [
    "- Do: TODO capture one approved visual behavior.",
    "- Do: TODO capture another approved visual behavior.",
    "- Don't: TODO capture one disallowed visual behavior.",
    "- Don't: TODO capture another disallowed visual behavior.",
  ],
}

interface ParsedDesignSection {
  heading: string
  body: string
}

function parseTopLevelSections(content: string): ParsedDesignSection[] {
  const headingMatches = [...content.matchAll(/^## (.+)$/gm)]

  return headingMatches.map((match, index) => {
    const heading = match[1] ?? ""
    const start = (match.index ?? 0) + match[0].length
    const end = headingMatches[index + 1]?.index ?? content.length

    return {
      heading,
      body: content.slice(start, end).trim(),
    }
  })
}

export function validateDesignPath(designPath: string): { valid: boolean; error?: string } {
  const normalizedInput = designPath.replaceAll("\\", "/")

  if (isAbsolute(designPath)) {
    return { valid: false, error: "designPath must be a relative path" }
  }

  if (normalizedInput.startsWith("../") || normalizedInput.includes("/../") || normalizedInput === "..") {
    return { valid: false, error: "designPath must not traverse parent directories" }
  }

  return { valid: true }
}

export function scaffoldDesignMd(): string {
  return GOOGLE_STITCH_ADAPTER.designSections
    .map((section) => {
      const sectionContent = DESIGN_SECTION_CONTENT[section]

      if (!sectionContent) {
        throw new Error(`Missing scaffold content for section: ${section}`)
      }

      return `## ${section}\n${sectionContent.join("\n")}`
    })
    .join("\n\n")
}

export function bootstrapDesignMd(designPath: string, cwd: string): void {
  const validation = validateDesignPath(designPath)
  if (!validation.valid) {
    throw new Error(validation.error ?? "Invalid designPath")
  }

  const normalizedDesignPath = designPath.startsWith("./") ? designPath.slice(2) : designPath
  const absolutePath = join(cwd, normalizedDesignPath)
  const parentDir = dirname(absolutePath)

  mkdirSync(parentDir, { recursive: true })

  if (!existsSync(absolutePath)) {
    writeFileSync(absolutePath, scaffoldDesignMd())
  }
}

export function validateDesignMd(content: string): DesignMdValidationResult {
  const errors: string[] = []
  const canonicalSections = [...GOOGLE_STITCH_ADAPTER.designSections]
  const parsedSections = parseTopLevelSections(content)
  const headings = parsedSections.map((section) => section.heading)
  const counts = new Map<string, number>()

  for (const heading of headings) {
    counts.set(heading, (counts.get(heading) ?? 0) + 1)
  }

  for (const section of canonicalSections) {
    if (!headings.includes(section)) {
      errors.push(`Missing required section: ${section}`)
    }
  }

  for (const [heading, count] of counts.entries()) {
    if (count > 1) {
      errors.push(`Duplicate top-level section: ${heading}`)
    }
  }

  const hasCanonicalOrder =
    headings.length === canonicalSections.length && canonicalSections.every((section, index) => headings[index] === section)

  if (!hasCanonicalOrder) {
    errors.push(`Sections must appear in canonical order: ${canonicalSections.join(", ")}`)
  }

  const colorsSection = parsedSections.find((section) => section.heading === "Colors")
  if (colorsSection) {
    for (const colorName of ["Primary", "Secondary", "Tertiary", "Neutral"]) {
      if (!new RegExp(`^${colorName}:`, "m").test(colorsSection.body)) {
        errors.push(`Colors section must include ${colorName}:`)
      }
    }
  }

  const dosAndDontsSection = parsedSections.find((section) => section.heading === "Do's and Don'ts")
  if (dosAndDontsSection) {
    const doCount = dosAndDontsSection.body.match(/^- Do:/gm)?.length ?? 0
    const dontCount = dosAndDontsSection.body.match(/^- Don't:/gm)?.length ?? 0

    if (doCount < 2) {
      errors.push("Do's and Don'ts section must include at least 2 '- Do:' bullets")
    }

    if (dontCount < 2) {
      errors.push("Do's and Don'ts section must include at least 2 '- Don't:' bullets")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
