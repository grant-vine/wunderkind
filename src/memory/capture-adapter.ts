import { MEMORY_AUTOMATIC_CAPTURE_CONTRACT } from "../cli/memory-contract.js"
import { normalizeMemoryEvent, type MemoryCaptureInput } from "./providers.js"
import { enqueueMemoryOverSocket, type MemorySocketEnqueueOptions } from "./worker-socket.js"
import type { MemoryWorkerResult } from "./worker.js"

export interface AutomaticCaptureAdapterOptions {
  readonly enabled: boolean
  readonly declaredHook: string | null
  readonly socketPath: string
  readonly enqueueTimeoutMs: number
  readonly enqueue?: (input: MemorySocketEnqueueOptions) => Promise<MemoryWorkerResult>
}

export interface AutomaticCaptureOutcome<HostOutput> {
  readonly output: HostOutput
  readonly result: MemoryWorkerResult
}

export interface AutomaticCaptureAdapter {
  capture<HostOutput>(input: MemoryCaptureInput, output: HostOutput): Promise<AutomaticCaptureOutcome<HostOutput>>
}

const DISABLED_RESULT: MemoryWorkerResult = { status: "rejected", factIds: [] }
const FALLBACK_RESULT: MemoryWorkerResult = { status: "unavailable", factIds: [] }

export function createAutomaticCaptureAdapter(options: AutomaticCaptureAdapterOptions): AutomaticCaptureAdapter {
  const enqueue = options.enqueue ?? enqueueMemoryOverSocket
  const enabled = options.enabled && options.declaredHook === MEMORY_AUTOMATIC_CAPTURE_CONTRACT.mode
  return {
    async capture(input, output): Promise<AutomaticCaptureOutcome<typeof output>> {
      if (!enabled) return { output, result: DISABLED_RESULT }
      try {
        const event = normalizeMemoryEvent(input)
        const result = await enqueue({ socketPath: options.socketPath, event, enqueueTimeoutMs: options.enqueueTimeoutMs })
        return { output, result }
      } catch {
        return { output, result: FALLBACK_RESULT }
      }
    },
  }
}
