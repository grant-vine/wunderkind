import { readFileSync, writeFileSync } from "node:fs"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"

function argument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (value === undefined || value.trim() === "") throw new Error(`${name} is required`)
  return value
}

const portFile = argument("--port-file")
const response = readFileSync(argument("--response"), "utf8")
const server = createServer((request: IncomingMessage, responseWriter: ServerResponse) => {
  if (request.method !== "POST" || new URL(request.url ?? "/", "http://127.0.0.1").pathname !== "/api/generate") {
    responseWriter.statusCode = 404
    responseWriter.end("not found")
    return
  }
  responseWriter.setHeader("content-type", "application/json")
  responseWriter.end(response)
})
server.listen(0, "127.0.0.1", () => {
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("failed to bind fake Ollama server")
  writeFileSync(portFile, `${address.port}\n`)
})
