declare module "@opencode-ai/plugin/tool" {
  import { z } from "zod"

  export type ToolContext = {
    sessionID: string
    messageID: string
    agent: string
    directory: string
    worktree: string
    abort: AbortSignal
    metadata(input: { title?: string; metadata?: { [key: string]: unknown } }): void
    ask(input: {
      permission: string
      patterns: string[]
      always: string[]
      metadata: { [key: string]: unknown }
    }): Promise<void>
  }

  export type ToolAttachment = {
    type: "file"
    mime: string
    url: string
    filename?: string
  }

  export type ToolResult = string | {
    title?: string
    output: string
    metadata?: { [key: string]: unknown }
    attachments?: ToolAttachment[]
  }

  export function tool<Args extends z.ZodRawShape>(input: {
    description: string
    args: Args
    execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<ToolResult>
  }): {
    description: string
    args: Args
    execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<ToolResult>
  }

  export namespace tool {
    const schema: typeof z
  }

  export type ToolDefinition = ReturnType<typeof tool>
}

declare module "@opencode-ai/plugin/dist/tool.js" {
  export * from "@opencode-ai/plugin/tool"
}
