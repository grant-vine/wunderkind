import { describe, expect, it } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { createServer as createSocketServer } from "node:net"

import {
  createLocalSystemOneAdapter,
  parseSystemOneRequest,
  type SystemOneRequest,
  type SystemOneTokenPreflight,
} from "../../src/experimental/system-one/adapter.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const REPLAY_FIXTURE = resolve(PROJECT_ROOT, ".omo/evidence/stack-audit-upgrade-2026-10-10/task-5/raw/replayable-system-one-fixture.json")
const REPLAY_FIXTURE_SHA256 = "11c6896e16c99180a0bcf146bcd2239a440ac60cb5a047735b97cc21966a189b"
const REPLAY_FIXTURE_BYTES = 652079
const MODEL_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101"
const TOKENIZER_JSON_SHA256 = "06b9509352d2af50381ab2247e083b80d32d5c0aba91c272ca9ff729b6a0e523"
const KEV_API_SOURCE_SHA256 = "a6f53af5354f8ea17915abc78360fdf291a5108ce39a53a2d9135d48c603ae58"
const PROXY_NAMES = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"] as const

for (const name of PROXY_NAMES) delete process.env[name]

declare const Bun: {
  serve(options: {
    readonly port: number
    readonly hostname: string
    readonly fetch: (request: Request) => Response | Promise<Response>
  }): {
    readonly port: number
    stop(closeActiveConnections?: boolean): Promise<void>
  }
  spawn(options: {
    readonly cmd: readonly string[]
    readonly cwd: string
    readonly env?: Record<string, string | undefined>
  }): { readonly exited: Promise<number> }
}

type FakeServer = {
  readonly endpoint: string
  readonly close: () => Promise<void>
  readonly requests: () => number
}

type ReplayRecord = {
  readonly record_index: number
  readonly request: SystemOneRequest
}

type ReplayFixture = {
  readonly records: readonly ReplayRecord[]
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

function makePreflight(request: SystemOneRequest, stateTokens: number = 12): SystemOneTokenPreflight {
  return {
    contract: "wunderkind-kev-4b-token-count-preflight-v1",
    model: "jaredpalmer/kev-4b",
    modelRevision: MODEL_REVISION,
    tokenizerJsonSha256: TOKENIZER_JSON_SHA256,
    kevApiSourceSha256: KEV_API_SOURCE_SHA256,
    requestSha256: sha256(JSON.stringify(request)),
    stateJsonSha256: sha256(JSON.stringify(request.state)),
    renderedStateSha256: "f".repeat(64),
    stateTokens,
  }
}

function choiceRequest(): SystemOneRequest {
  return {
    model: "kev-latest",
    state: { policy: "returns", case: "broken lamp" },
    questions: {
      decision: {
        type: "choice",
        instructions: "Does it qualify?",
        criteria: { no: "not qualified", yes: "qualified" },
      },
    },
  }
}

function structuredRequest(): SystemOneRequest {
  return {
    model: "kev-latest",
    state: { active: true, note: null, amount: 1, nested: [false, 2.5] },
    questions: {
      score: {
        type: "score",
        instructions: null,
        criteria: [null],
      },
    },
  }
}

function validResponse(request: SystemOneRequest): Response {
  const answers: Record<string, unknown> = {}
  for (const [questionId, question] of Object.entries(request.questions)) {
    switch (question.type) {
      case "noul":
        answers[questionId] = { type: "noul", noul: 0.75 }
        break
      case "choice": {
        const choices = Object.keys(question.criteria)
        const choice = choices[0]
        if (choice === undefined) throw new Error("test choice criteria cannot be empty")
        const remainingProbability = choices.length === 1 ? 0 : 0.25 / (choices.length - 1)
        answers[questionId] = {
          type: "choice",
          choice,
          confidence: 0.75,
          probabilities: Object.fromEntries(choices.map((key, index) => [key, choices.length === 1 ? 1 : index === 0 ? 0.75 : remainingProbability])),
        }
        break
      }
      case "score":
        answers[questionId] = {
          type: "score",
          score: question.criteria.length === 1 ? 0 : 0.5,
          confidence: 0.5,
          legend: Object.fromEntries(question.criteria.map((_criterion, index) => [String(index), `level ${index}`])),
          probabilities: Object.fromEntries(question.criteria.map((_, index) => [String(index), 1 / question.criteria.length])),
        }
        break
    }
  }
  return Response.json({ model: "kev-latest", answers, usage: { input_tokens: 12, output_tokens: 4 } })
}

async function startFakeServer(handler: (request: Request) => Response | Promise<Response>): Promise<FakeServer> {
  let requestCount = 0
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      requestCount += 1
      return handler(request)
    },
  })
  return {
    endpoint: `http://127.0.0.1:${server.port}`,
    close: async () => {
      await server.stop(true)
    },
    requests: () => requestCount,
  }
}

async function reserveLoopbackPort(): Promise<number> {
  const server = createSocketServer()
  await new Promise<void>((resolve, reject) => server.listen(0, "127.0.0.1", (error?: Error) => error === undefined ? resolve() : reject(error)))
  const address = server.address()
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)))
    throw new Error("ephemeral loopback port allocation failed")
  }
  const port = address.port
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)))
  return port
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readReplayFixture(): ReplayFixture {
  const parsed: unknown = JSON.parse(readFileSync(REPLAY_FIXTURE, "utf8"))
  if (!isRecord(parsed) || !Array.isArray(parsed["records"])) {
    throw new Error("replay fixture is malformed")
  }
  const records: ReplayRecord[] = []
  for (const value of parsed["records"]) {
    if (!isRecord(value) || typeof value["record_index"] !== "number") {
      throw new Error("replay fixture record is malformed")
    }
    const request = parseSystemOneRequest(value["request"])
    if (request === null) throw new Error("replay fixture request is malformed")
    records.push({ record_index: value["record_index"], request })
  }
  return { records }
}

function createRunnerPreflight(records: readonly ReplayRecord[]): string {
  return JSON.stringify({
    contract: "wunderkind-kev-4b-token-count-preflight-v1",
    model: "jaredpalmer/kev-4b",
    model_revision: MODEL_REVISION,
    tokenizer_json_sha256: TOKENIZER_JSON_SHA256,
    kev_api_source_sha256: KEV_API_SOURCE_SHA256,
    render_command: "python task14-render.py --kev-api-source-pinned",
    count_command: "python task14-token-count.py --exact-kev-tokenizer",
    records: records.map((record) => ({
      record_index: record.record_index,
      request_sha256: sha256(JSON.stringify(record.request)),
      state_json_sha256: sha256(JSON.stringify(record.request.state)),
      rendered_state_sha256: "f".repeat(64),
      state_tokens: 12,
    })),
  })
}

async function runRunner(command: readonly string[], environment?: Record<string, string | undefined>): Promise<number> {
  if (environment === undefined) return Bun.spawn({ cmd: command, cwd: PROJECT_ROOT }).exited
  return Bun.spawn({ cmd: command, cwd: PROJECT_ROOT, env: environment }).exited
}

describe("LocalSystemOneAdapter", () => {
  it("returns the original request without opening a connection when disabled", async () => {
    const fake = await startFakeServer(() => Response.json({ unexpected: true }))
    try {
      const request = choiceRequest()
      const result = await createLocalSystemOneAdapter({ enabled: false, endpoint: fake.endpoint }).evaluate(request, makePreflight(request))

      expect(result).toEqual({ kind: "passthrough", request, reason: "disabled" })
      expect(fake.requests()).toBe(0)
    } finally {
      await fake.close()
    }
  })

  it("posts only the System One request to an enabled literal loopback server", async () => {
    const request = choiceRequest()
    let received: unknown
    const fake = await startFakeServer(async (incoming) => {
      expect(incoming.method).toBe("POST")
      expect(new URL(incoming.url).pathname).toBe("/v1/systemone")
      received = await incoming.json()
      return validResponse(request)
    })
    try {
      const result = await createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint }).evaluate(request, makePreflight(request))

      expect(result.kind).toBe("answer")
      expect(received).toEqual(request)
      expect(fake.requests()).toBe(1)
    } finally {
      await fake.close()
    }
  })

  it("preserves reserved question, criterion, and typed-answer IDs end to end", async () => {
    const reservedIds = ["__proto__", "constructor", "prototype"]
    const rawRequest = {
      model: "kev-latest",
      state: null,
      questions: Object.fromEntries(reservedIds.map((questionId) => [questionId, {
        type: "choice",
        criteria: Object.fromEntries(reservedIds.map((criterionId) => [criterionId, criterionId])),
      }])),
    }
    const request = parseSystemOneRequest(rawRequest)
    expect(request).not.toBe(null)
    if (request === null) return
    expect(Object.keys(request.questions)).toEqual(reservedIds)
    expect(Object.getPrototypeOf(request.questions)).toBe(Object.prototype)
    expect(Object.keys(request.questions["__proto__"]?.criteria ?? {})).toEqual(reservedIds)
    expect(Object.getPrototypeOf(request.questions["__proto__"]?.criteria)).toBe(Object.prototype)

    let received: unknown
    const fake = await startFakeServer(async (incoming) => {
      received = await incoming.json()
      const answers = Object.fromEntries(reservedIds.map((questionId) => [questionId, {
        type: "choice",
        choice: "__proto__",
        confidence: 1,
        probabilities: Object.fromEntries(reservedIds.map((criterionId, index) => [criterionId, index === 0 ? 1 : 0])),
      }]))
      return Response.json({ model: "kev-latest", answers, usage: { input_tokens: 1, output_tokens: 1 } })
    })
    try {
      const result = await createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint }).evaluate(request, makePreflight(request))
      expect(result.kind).toBe("answer")
      expect(received).toEqual(request)
      if (result.kind === "answer" && result.response.answers["__proto__"]?.type === "choice") {
        expect(Object.keys(result.response.answers)).toEqual(reservedIds)
        expect(Object.getPrototypeOf(result.response.answers)).toBe(Object.prototype)
        expect(Object.keys(result.response.answers["__proto__"]?.probabilities ?? {})).toEqual(reservedIds)
        expect(Object.getPrototypeOf(result.response.answers["__proto__"]?.probabilities)).toBe(Object.prototype)
      }
      expect(fake.requests()).toBe(1)
    } finally {
      await fake.close()
    }
  })

  it("preserves primitive roots, null, and one-level score JSONContent for the Kev server", async () => {
    const requests = [
      structuredRequest(),
      { ...structuredRequest(), state: true },
      { ...structuredRequest(), state: 1 },
      { ...structuredRequest(), state: null },
    ] satisfies readonly SystemOneRequest[]
    const received: unknown[] = []
    const fake = await startFakeServer(async (incoming) => {
      received.push(await incoming.json())
      const request = requests[received.length - 1]
      if (request === undefined) throw new Error("unexpected System One transport request")
      return validResponse(request)
    })
    try {
      const adapter = createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint })
      for (const request of requests) {
        const result = await adapter.evaluate(request, makePreflight(request))

        expect(result.kind).toBe("answer")
      }
      expect(received).toEqual(requests)
      expect(fake.requests()).toBe(requests.length)
    } finally {
      await fake.close()
    }
  })

  for (const status of [301, 302, 307]) {
    it(`rejects HTTP ${status} without following the redirect`, async () => {
      const request = choiceRequest()
      const fake = await startFakeServer(() => new Response(null, { status, headers: { location: "http://example.test/steal" } }))
      try {
        const result = await createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint }).evaluate(request, makePreflight(request))

        expect(result).toEqual({ kind: "passthrough", request, reason: "transport_failed" })
        expect(fake.requests()).toBe(1)
      } finally {
        await fake.close()
      }
    })
  }

  it("rejects remote and non-literal loopback endpoint forms before transport", async () => {
    const request = choiceRequest()
    const remote = await createLocalSystemOneAdapter({ enabled: true, endpoint: "http://localhost:9999" }).evaluate(request, makePreflight(request))
    expect(remote).toEqual({ kind: "passthrough", request, reason: "endpoint_rejected" })

    for (const aliasEndpoint of ["http://127.1:9999", "http://2130706433:9999", "http://0x7f000001:9999", "http://0177.0.0.1:9999"]) {
      const alias = await createLocalSystemOneAdapter({ enabled: true, endpoint: aliasEndpoint }).evaluate(request, makePreflight(request))
      expect(alias).toEqual({ kind: "passthrough", request, reason: "endpoint_rejected" })
    }
  })

  it("preserves the request for invalid answers, timeouts, and refused connections", async () => {
    const request = choiceRequest()
    const malformed = await startFakeServer(() => Response.json({ model: "kev-latest", answers: { decision: { type: "choice", choice: "yes", confidence: 1, probabilities: { yes: 2, no: -1 } } }, usage: { input_tokens: 1, output_tokens: 1 } }))
    try {
      const invalid = await createLocalSystemOneAdapter({ enabled: true, endpoint: malformed.endpoint }).evaluate(request, makePreflight(request))
      expect(invalid).toEqual({ kind: "passthrough", request, reason: "invalid_response" })
    } finally {
      await malformed.close()
    }

    const wrongAnswerCount = await startFakeServer(() => Response.json({ model: "kev-latest", answers: {}, usage: { input_tokens: 1, output_tokens: 1 } }))
    try {
      const invalid = await createLocalSystemOneAdapter({ enabled: true, endpoint: wrongAnswerCount.endpoint }).evaluate(request, makePreflight(request))
      expect(invalid).toEqual({ kind: "passthrough", request, reason: "invalid_response" })
    } finally {
      await wrongAnswerCount.close()
    }

    const stalled = await startFakeServer(() => new Promise<Response>(() => undefined))
    try {
      const timeout = await createLocalSystemOneAdapter({ enabled: true, endpoint: stalled.endpoint, timeoutMs: 20 }).evaluate(request, makePreflight(request))
      expect(timeout).toEqual({ kind: "passthrough", request, reason: "transport_failed" })
    } finally {
      await stalled.close()
    }

    const refusedPort = await reserveLoopbackPort()
    const refused = await createLocalSystemOneAdapter({ enabled: true, endpoint: `http://127.0.0.1:${refusedPort}`, timeoutMs: 20 }).evaluate(request, makePreflight(request))
    expect(refused).toEqual({ kind: "passthrough", request, reason: "transport_failed" })
  })

  it("makes zero calls for malformed requests, missing or mismatched preflight, and unverified token limits", async () => {
    const request = choiceRequest()
    const fake = await startFakeServer(() => validResponse(request))
    try {
      const adapter = createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint })
      const malformed = await adapter.evaluate({ state: "state", questions: {} }, makePreflight(request))
      const missing = await adapter.evaluate(request)
      const mismatched = await adapter.evaluate(request, { ...makePreflight(request), stateJsonSha256: "0".repeat(64) })
      const overLimit = await adapter.evaluate(request, makePreflight(request, 8193))
      const tooManyChoice = await adapter.evaluate({ model: "kev-latest", state: null, questions: { decision: { type: "choice", criteria: Object.fromEntries(Array.from({ length: 256 }, (_value, index) => [String(index), null])) } } }, makePreflight(request))
      const tooManyScore = await adapter.evaluate({ model: "kev-latest", state: null, questions: { score: { type: "score", criteria: Array.from({ length: 256 }, () => null) } } }, makePreflight(request))

      expect(malformed).toEqual({ kind: "passthrough", request: { state: "state", questions: {} }, reason: "invalid_request" })
      expect(missing).toEqual({ kind: "passthrough", request, reason: "preflight_missing" })
      expect(mismatched).toEqual({ kind: "passthrough", request, reason: "preflight_invalid" })
      expect(overLimit).toEqual({ kind: "passthrough", request, reason: "preflight_over_limit" })
      expect(tooManyChoice.kind).toBe("passthrough")
      expect(tooManyScore.kind).toBe("passthrough")
      if (tooManyChoice.kind === "passthrough") expect(tooManyChoice.reason).toBe("invalid_request")
      if (tooManyScore.kind === "passthrough") expect(tooManyScore.reason).toBe("invalid_request")
      expect(fake.requests()).toBe(0)
    } finally {
      await fake.close()
    }
  })

  it("passes through hostile preflight inputs without inspecting transport", async () => {
    const request = { model: "kev-latest", state: null, questions: { q: { type: "noul" } } } satisfies SystemOneRequest
    const fake = await startFakeServer(() => validResponse(request))
    try {
      const adapter = createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint })
      const throwingGetter = Object.defineProperty({}, "contract", { get: () => { throw new Error("hostile-preflight-getter") } })
      const throwingProxy = new Proxy({}, { get: () => { throw new Error("hostile-preflight-proxy") } })

      const getterResult = await adapter.evaluate(request, throwingGetter)
      const proxyResult = await adapter.evaluate(request, throwingProxy)

      expect(getterResult).toEqual({ kind: "passthrough", request, reason: "preflight_invalid" })
      expect(proxyResult).toEqual({ kind: "passthrough", request, reason: "preflight_invalid" })
      expect(getterResult.request).toBe(request)
      expect(proxyResult.request).toBe(request)
      expect(fake.requests()).toBe(0)

      const disabledResult = await createLocalSystemOneAdapter({ enabled: false, endpoint: fake.endpoint }).evaluate(request, throwingGetter)
      expect(disabledResult).toEqual({ kind: "passthrough", request, reason: "disabled" })
      expect(fake.requests()).toBe(0)
    } finally {
      await fake.close()
    }
  })

  it("passes through cyclic, deeply nested, and throwing malformed state without transport", async () => {
    const fake = await startFakeServer(() => validResponse(choiceRequest()))
    try {
      const adapter = createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint })
      const cyclic: { model: "kev-latest"; state: Record<string, unknown>; questions: SystemOneRequest["questions"] } = {
        model: "kev-latest",
        state: {},
        questions: choiceRequest().questions,
      }
      cyclic.state["self"] = cyclic.state

      const deepState: unknown[] = []
      let cursor = deepState
      for (let index = 0; index < 30_000; index += 1) {
        const next: unknown[] = []
        cursor.push(next)
        cursor = next
      }
      const deeplyNested = { model: "kev-latest", state: deepState, questions: choiceRequest().questions }
      const throwingState = {
        model: "kev-latest",
        state: Object.defineProperty({}, "negative", { enumerable: true, get: () => { throw new Error("malformed state") } }),
        questions: choiceRequest().questions,
      }

      const cyclicResult = await adapter.evaluate(cyclic)
      const deepResult = await adapter.evaluate(deeplyNested)
      const throwingResult = await adapter.evaluate(throwingState)

      expect(cyclicResult).toEqual({ kind: "passthrough", request: cyclic, reason: "invalid_request" })
      expect(deepResult).toEqual({ kind: "passthrough", request: deeplyNested, reason: "invalid_request" })
      expect(throwingResult).toEqual({ kind: "passthrough", request: throwingState, reason: "invalid_request" })
      expect(cyclicResult.request).toBe(cyclic)
      expect(deepResult.request).toBe(deeplyNested)
      expect(throwingResult.request).toBe(throwingState)
      expect(fake.requests()).toBe(0)
    } finally {
      await fake.close()
    }
  })

  it("rejects primitive and split-question requests at one shared JSON budget", async () => {
    const fake = await startFakeServer(() => validResponse(choiceRequest()))
    try {
      const adapter = createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint })
      const primitiveArrayRequest = { model: "kev-latest", state: Array.from({ length: 100_001 }, () => null), questions: choiceRequest().questions }
      const splitQuestionRequest = {
        model: "kev-latest",
        state: null,
        questions: {
          first: { type: "noul", instructions: Array.from({ length: 50_000 }, () => null) },
          second: { type: "noul", instructions: Array.from({ length: 50_000 }, () => null) },
        },
      }

      expect(parseSystemOneRequest(primitiveArrayRequest)).toBe(null)
      expect(parseSystemOneRequest(splitQuestionRequest)).toBe(null)
      const primitiveResult = await adapter.evaluate(primitiveArrayRequest)
      const splitResult = await adapter.evaluate(splitQuestionRequest)

      expect(primitiveResult).toEqual({ kind: "passthrough", request: primitiveArrayRequest, reason: "invalid_request" })
      expect(splitResult).toEqual({ kind: "passthrough", request: splitQuestionRequest, reason: "invalid_request" })
      expect(fake.requests()).toBe(0)
    } finally {
      await fake.close()
    }
  })

  it("returns null for throwing proxies while accepting shared references", async () => {
    const fake = await startFakeServer(() => validResponse(choiceRequest()))
    try {
      const adapter = createLocalSystemOneAdapter({ enabled: true, endpoint: fake.endpoint })
      const ownKeysThrow = new Proxy({}, { ownKeys: () => { throw new Error("ownKeys") } })
      const getterThrow = new Proxy({ model: "kev-latest", state: null, questions: choiceRequest().questions }, { get: (_target, key) => { if (key === "state") throw new Error("getter"); return undefined } })
      const shared = { nested: true }
      const sharedRequest = { model: "kev-latest", state: { first: shared, second: shared }, questions: choiceRequest().questions }

      expect(parseSystemOneRequest(ownKeysThrow)).toBe(null)
      expect(parseSystemOneRequest(getterThrow)).toBe(null)
      expect(parseSystemOneRequest(sharedRequest)).not.toBe(null)
      const ownKeysResult = await adapter.evaluate(ownKeysThrow)
      const getterResult = await adapter.evaluate(getterThrow)

      expect(ownKeysResult).toEqual({ kind: "passthrough", request: ownKeysThrow, reason: "invalid_request" })
      expect(getterResult).toEqual({ kind: "passthrough", request: getterThrow, reason: "invalid_request" })
      expect(fake.requests()).toBe(0)
    } finally {
      await fake.close()
    }
  })

  it("drives the explicit runner through the pinned fixture and rejects dirty, stale, and misleading inputs", async () => {
    const fixtureBytes = readFileSync(REPLAY_FIXTURE)
    expect(fixtureBytes.byteLength).toBe(REPLAY_FIXTURE_BYTES)
    expect(sha256(fixtureBytes)).toBe(REPLAY_FIXTURE_SHA256)
    const fixture = readReplayFixture()
    const directory = mkdtempSync(join(tmpdir(), "wk-system-one-runner-"))
    const preflightPath = join(directory, "preflight.json")
    const outputPath = process.env["SYSTEM_ONE_QA_OUTPUT"] ?? join(directory, "results.jsonl")
    writeFileSync(preflightPath, createRunnerPreflight(fixture.records))
    const receivedBodies: string[] = []

    const fake = await startFakeServer(async (incoming) => {
      const body = await incoming.text()
      const request = parseSystemOneRequest(JSON.parse(body))
      if (request === null) return new Response("invalid request", { status: 400 })
      receivedBodies.push(body)
      return validResponse(request)
    })
    try {
      const runnerCommand = ["bun", "run", "scripts/kev-system-one-eval.ts", "--enabled", "--endpoint", fake.endpoint, "--samples", REPLAY_FIXTURE, "--token-preflight", preflightPath, "--out", outputPath]
      const runnerCommandPath = process.env["SYSTEM_ONE_QA_COMMAND"]
      if (runnerCommandPath !== undefined) writeFileSync(runnerCommandPath, `COMMAND: ${runnerCommand.join(" ")}\n`)
      const success = await runRunner(runnerCommand, { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: "" })
      expect(success).toBe(0)
      expect(readFileSync(outputPath, "utf8").trim().split("\n")).toHaveLength(454)
      expect(fake.requests()).toBe(454)
      expect(receivedBodies).toEqual(fixture.records.map((record) => JSON.stringify(record.request)))

      const proxy = await runRunner(["bun", "run", "scripts/kev-system-one-eval.ts", "--enabled", "--endpoint", fake.endpoint, "--samples", REPLAY_FIXTURE, "--token-preflight", preflightPath, "--out", join(directory, "proxy-results.jsonl")], { ...process.env, HTTP_PROXY: "http://proxy.invalid:8080", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: "" })
      expect(proxy).not.toBe(0)
      expect(fake.requests()).toBe(454)

      const dirtyPath = join(directory, "dirty.json")
      writeFileSync(dirtyPath, `${readFileSync(REPLAY_FIXTURE, "utf8")}\n`)
      const dirty = await runRunner(["bun", "run", "scripts/kev-system-one-eval.ts", "--enabled", "--endpoint", fake.endpoint, "--samples", dirtyPath, "--token-preflight", preflightPath, "--out", join(directory, "dirty-results.jsonl")])
      expect(dirty).not.toBe(0)
      expect(fake.requests()).toBe(454)

      const stalePath = join(directory, "stale.json")
      writeFileSync(stalePath, createRunnerPreflight(fixture.records.slice(1)))
      const stale = await runRunner(["bun", "run", "scripts/kev-system-one-eval.ts", "--enabled", "--endpoint", fake.endpoint, "--samples", REPLAY_FIXTURE, "--token-preflight", stalePath, "--out", join(directory, "stale-results.jsonl")])
      expect(stale).not.toBe(0)
      expect(fake.requests()).toBe(454)
    } finally {
      await fake.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
