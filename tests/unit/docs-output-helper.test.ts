import { describe, expect, it } from "bun:test"

import {
  buildAppendDatedHeading,
  buildNewDatedFilename,
  formatDocsHistoryTimestamp,
  isManagedDocsFamilyFilename,
} from "../../src/cli/docs-output-helper.js"

describe("docs-output-helper timestamp formatting", () => {
  it("formats docs history timestamps as sortable UTC tokens", () => {
    expect(formatDocsHistoryTimestamp(new Date("2026-03-12T18:37:52.000Z"))).toBe("2026-03-12T18-37-52Z")
  })

  it("sorts lexicographically in chronological order", () => {
    const earlier = formatDocsHistoryTimestamp(new Date("2026-03-12T18:37:51.000Z"))
    const later = formatDocsHistoryTimestamp(new Date("2026-03-12T18:37:52.000Z"))

    expect(earlier < later).toBe(true)
  })
})

describe("docs-output-helper append-dated headings", () => {
  it("builds the initial update heading without a collision suffix", () => {
    expect(buildAppendDatedHeading("2026-03-12T18-37-52Z", 1)).toBe("## Update 2026-03-12T18-37-52Z")
  })

  it("adds a collision suffix for repeated headings", () => {
    expect(buildAppendDatedHeading("2026-03-12T18-37-52Z", 2)).toBe("## Update 2026-03-12T18-37-52Z (2)")
  })
})

describe("docs-output-helper new-dated-file naming", () => {
  it("builds the first dated filename from a canonical markdown file", () => {
    expect(buildNewDatedFilename("marketing-strategy.md", "2026-03-12T18-37-52Z", 1)).toBe(
      "marketing-strategy--2026-03-12T18-37-52Z.md",
    )
  })

  it("adds a collision suffix for repeated filenames", () => {
    expect(buildNewDatedFilename("marketing-strategy.md", "2026-03-12T18-37-52Z", 2)).toBe(
      "marketing-strategy--2026-03-12T18-37-52Z--2.md",
    )
  })

  it("recognizes timestamped managed-family files", () => {
    expect(isManagedDocsFamilyFilename("marketing-strategy.md", "marketing-strategy--2026-03-12T18-37-52Z.md")).toBe(true)
    expect(isManagedDocsFamilyFilename("marketing-strategy.md", "marketing-strategy--2026-03-12T18-37-52Z--2.md")).toBe(true)
    expect(isManagedDocsFamilyFilename("marketing-strategy.md", "design-decisions--2026-03-12T18-37-52Z.md")).toBe(false)
  })
})
