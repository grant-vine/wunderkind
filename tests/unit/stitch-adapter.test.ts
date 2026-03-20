import { describe, expect, it } from "bun:test"
import { GOOGLE_STITCH_ADAPTER } from "../../src/cli/mcp-adapters.js"

describe("google stitch adapter contract", () => {
  it("defines the expected static adapter metadata", () => {
    expect(GOOGLE_STITCH_ADAPTER.serverName).toBe("google-stitch")
    expect(GOOGLE_STITCH_ADAPTER.remoteUrl).toBe("https://stitch.googleapis.com/mcp")
    expect(GOOGLE_STITCH_ADAPTER.authMode).toBe("api-key-file")
    expect(GOOGLE_STITCH_ADAPTER.secretFilePath).toBe(".wunderkind/stitch/google-stitch-api-key")
    expect(GOOGLE_STITCH_ADAPTER.fallbackEnvVar).toBe("GOOGLE_STITCH_API_KEY")
    expect(GOOGLE_STITCH_ADAPTER.verificationCommand).toBe(
      'curl -s -o /dev/null -w "%{http_code}" https://stitch.googleapis.com/mcp',
    )
    expect(GOOGLE_STITCH_ADAPTER.headerTemplate.fileTemplate).toBe(
      "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
    )
    expect(GOOGLE_STITCH_ADAPTER.headerTemplate.envFallback).toBe("Bearer {env:GOOGLE_STITCH_API_KEY}")
  })

  it("keeps the canonical design section order", () => {
    expect(GOOGLE_STITCH_ADAPTER.designSections).toEqual([
      "Overview",
      "Colors",
      "Typography",
      "Elevation",
      "Components",
      "Do's and Don'ts",
    ])
  })

  it("builds the expected OpenCode MCP payload", () => {
    expect(GOOGLE_STITCH_ADAPTER.getOpenCodePayload()).toEqual({
      type: "remote",
      url: "https://stitch.googleapis.com/mcp",
      enabled: true,
      oauth: false,
      headers: {
        Authorization: "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
      },
    })

    expect(GOOGLE_STITCH_ADAPTER.getOpenCodePayload(true)).toEqual({
      type: "remote",
      url: "https://stitch.googleapis.com/mcp",
      enabled: true,
      oauth: false,
      headers: {
        Authorization: "Bearer {env:GOOGLE_STITCH_API_KEY}",
      },
    })
  })
})
