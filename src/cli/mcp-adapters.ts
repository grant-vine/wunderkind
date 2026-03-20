export interface McpAdapterHeaderTemplate {
  fileTemplate: string
  envFallback: string
}

export interface McpAdapterOpenCodePayload {
  type: "remote"
  url: string
  enabled: boolean
  oauth: boolean
  headers: Record<string, string>
}

export interface McpAdapter {
  serverName: string
  remoteUrl: string
  authMode: "api-key-file"
  secretFilePath: string
  fallbackEnvVar: string
  verificationCommand: string
  designSections: readonly string[]
  headerTemplate: McpAdapterHeaderTemplate
  getOpenCodePayload(useFileFallback?: boolean): McpAdapterOpenCodePayload
}

export const GOOGLE_STITCH_ADAPTER: McpAdapter = {
  serverName: "google-stitch",
  remoteUrl: "https://stitch.googleapis.com/mcp",
  authMode: "api-key-file",
  secretFilePath: ".wunderkind/stitch/google-stitch-api-key",
  fallbackEnvVar: "GOOGLE_STITCH_API_KEY",
  verificationCommand: 'curl -s -o /dev/null -w "%{http_code}" https://stitch.googleapis.com/mcp',
  designSections: ["Overview", "Colors", "Typography", "Elevation", "Components", "Do's and Don'ts"] as const,
  headerTemplate: {
    fileTemplate: "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
    envFallback: "Bearer {env:GOOGLE_STITCH_API_KEY}",
  },
  getOpenCodePayload(useFileFallback = false): McpAdapterOpenCodePayload {
    return {
      type: "remote",
      url: "https://stitch.googleapis.com/mcp",
      enabled: true,
      oauth: false,
      headers: {
        Authorization: useFileFallback
          ? "Bearer {env:GOOGLE_STITCH_API_KEY}"
          : "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
      },
    }
  },
}
