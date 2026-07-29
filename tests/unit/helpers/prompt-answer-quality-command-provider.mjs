#!/usr/bin/env node

const input = JSON.parse(await new Response(Bun.stdin.stream()).text())

const answers = {
  "answer-quality-latest-user-preserves-constraints": "The latest-user seam likely changed operator intent near `src/runtime-user-prompt-optimization.ts`, so preserve \"leave this exact text alone\" and the exact rerun command inside `src/cli/`.\n\n- Re-run `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts` beside `src/runtime-user-prompt-optimization.ts`.\n- Inspect the `src/cli/` caller and preserve the byte-exact latest-user constraint.",
  "answer-quality-runtime-tools-uses-noisy-output": "Summary: the repeated warnings point to runtime-owned retry noise rather than a new product bug.\nLikely cause: the retry loop is waiting on cache state; keep `Path: src/cli/prompt-optimization-runtime-reporting.ts` and `See https://example.com/tool-output/log for stable reference` exact.\nRerun: $ bun test tests/unit/prompt-optimization-efficacy.test.ts",
  "answer-quality-contextual-synthesizes-selected-context": "- Preserved invariants: keep `<!-- wunderkind:selected-context-preserve-start -->`, `<!-- wunderkind:selected-context-preserve-end -->`, `Path: src/runtime-transcript-compression.ts`, `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts`, and `https://example.com/context-spec` exact as protected preserve markers.\n- Compressible context: the repeated note is the safe shrink target, so compress the repeated diagnosis note outside the preserved span.",
  "answer-quality-transcript-reconciles-history": "- Latest request: keep `Latest request must remain untouched.` exactly.\n- Protected history: preserve `Background task id: bg_transcript123 remains session-local.`, `Quoted user example: \"keep this quote exact\".`, and `Path: src/runtime-user-prompt-optimization.ts` exactly.\n- Compressible history: repeated summaries are compressible; the practical preserve-versus-compress rule is preserving the latest request and protected literals while repeated summaries shrink and anything exact stays verbatim.",
}

const answer = answers[input.caseId]
if (typeof answer !== "string") {
  throw new Error(`Missing answer for ${input.caseId}`)
}

process.stdout.write(JSON.stringify({
  protocolMode: input.protocolMode,
  caseId: input.caseId,
  status: "ok",
  providerId: "command-provider",
  modelId: "command-model-v1",
  answer,
}))
