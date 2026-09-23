import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

function argument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (value === undefined || value.trim() === "") throw new Error(`${name} is required`)
  return value
}

const output = argument("--output")
const port = Number.parseInt(readFileSync(argument("--port-file"), "utf8"), 10)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("invalid Ollama port")
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify({ memory: { enabled: true, captureEnabled: false, injectionEnabled: true, extraction: { provider: "ollama", ollama: { baseUrl: `http://127.0.0.1:${port}`, model: "fake-memory", timeoutMs: 5000, enqueueTimeoutMs: 75, maxQueue: 64, maxResponseBytes: 32768 } } } }, null, 2)}\n`)
