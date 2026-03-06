declare module "@opencode-ai/plugin/dist/tool.js" {
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

  export function tool<Args extends z.ZodRawShape>(input: {
    description: string
    args: Args
    execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>
  }): {
    description: string
    args: Args
    execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>
  }

  export namespace tool {
    const schema: typeof z
  }

  export type ToolDefinition = ReturnType<typeof tool>
}
