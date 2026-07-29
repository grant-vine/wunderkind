import { PROMPT_OPTIMIZATION_LEVELS } from "./prompt-runtime-contract.js"
import {
  PROMPT_ANSWER_QUALITY_CONTRACT_MODE,
  PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID,
  PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS,
  PROMPT_ANSWER_QUALITY_RUBRIC_SCORES,
  type PromptAnswerQualityCasePack,
} from "./prompt-answer-quality-contract.js"

export const PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK: PromptAnswerQualityCasePack = {
  contractMode: PROMPT_ANSWER_QUALITY_CONTRACT_MODE,
  casePackId: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID,
  levelsCovered: PROMPT_OPTIMIZATION_LEVELS,
  cases: [
    {
      caseId: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS[0],
      caseType: "diagnosis",
      title: "Latest-user answer preserves quoted constraints and exact references",
      optimizationLevel: "latest-user",
      expectedOutcome:
        "A concise diagnosis that keeps the exact file path, command, and quoted requirement byte-exact while proposing the next two checks.",
      prompt: {
        systemInstruction:
          "You are reviewing a prompt-optimization regression. Answer in short markdown with one diagnosis paragraph and two next steps.",
        surfaces: {
          latestUserMessage: [
            "Diagnose why the latest-user optimization changed operator intent.",
            "Keep the file path `src/runtime-user-prompt-optimization.ts` exact.",
            "Keep the command `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts` exact.",
            'Keep the quoted request "leave this exact text alone" byte-exact.',
            "Do not recommend edits outside `src/cli/`.",
          ].join("\n"),
          runtimeOwnedSections: [], toolOutputs: [], selectedContext: [], retainedHistory: [], transcriptWideCompaction: [],
        },
      },
      rubric: {
        scale: PROMPT_ANSWER_QUALITY_RUBRIC_SCORES, passingScore: 10, maximumScore: 16,
        facets: [
          {
            facetId: "instruction-following",
            minimumScore: 2,
            guidance: "Stay concise and keep the requested answer shape: one diagnosis plus two next steps.",
            positiveSignals: ["One diagnosis paragraph", "Exactly two next steps"],
            failureSignals: ["Long essay", "Missing next steps"],
          },
          {
            facetId: "constraint-preservation",
            minimumScore: 3,
            guidance: "Preserve the exact path, command, quoted request, and `src/cli/` scope limit.",
            positiveSignals: ["Path preserved", "Command preserved", "Quote preserved"],
            failureSignals: ["Edited literals", "Suggests files outside src/cli/"],
          },
          {
            facetId: "evidence-use",
            minimumScore: 2,
            guidance: "Tie the diagnosis to the cited runtime-user optimization seam instead of generic advice.",
            positiveSignals: ["Mentions latest-user seam", "Uses the referenced file"],
            failureSignals: ["Purely generic debugging advice"],
          },
          {
            facetId: "actionability",
            minimumScore: 2,
            guidance: "Propose the next two checks an engineer can run immediately.",
            positiveSignals: ["Concrete next checks", "Runnable validation step"],
            failureSignals: ["Vague follow-up", "No runnable step"],
          },
        ],
      },
    },
    {
      caseId: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS[1],
      caseType: "triage",
      title: "Runtime-and-tools answer uses noisy tool output without repeating the noise",
      optimizationLevel: "runtime-and-tools",
      expectedOutcome:
        "A triage answer that surfaces the signal from repeated tool-output warnings, cites the durable path and URL once, and avoids echoing redundant noise.",
      prompt: {
        systemInstruction:
          "You are triaging a runtime-and-tools prompt pack. Answer with a short summary, one likely cause, and one command to rerun.",
        surfaces: {
          latestUserMessage:
            "Summarize the likely issue from the runtime-owned context and noisy tool output. Prefer signal over repetition.",
          runtimeOwnedSections: [
            "## Runtime Context\nPrompt optimization is active at the runtime-and-tools level with summary reporting enabled.",
            "## Native Agents\nThe helper must preserve exact operator-visible paths and commands even when tool output is compacted.",
          ],
          toolOutputs: [
            "warning: retrying noisy tool output", "warning: retrying noisy tool output",
            "warning: retrying noisy tool output", "progress: still waiting for remote cache",
            "progress: still waiting for remote cache", "Path: src/cli/prompt-optimization-runtime-reporting.ts",
            "See https://example.com/tool-output/log for stable reference",
            "$ bun test tests/unit/prompt-optimization-efficacy.test.ts", "status: completed",
          ],
          selectedContext: [], retainedHistory: [], transcriptWideCompaction: [],
        },
      },
      rubric: {
        scale: PROMPT_ANSWER_QUALITY_RUBRIC_SCORES, passingScore: 10, maximumScore: 16,
        facets: [
          {
            facetId: "instruction-following",
            minimumScore: 2,
            guidance: "Use the requested triage shape: short summary, one likely cause, one rerun command.",
            positiveSignals: ["Short summary", "Exactly one rerun command"],
            failureSignals: ["Unstructured answer", "Multiple conflicting commands"],
          },
          {
            facetId: "constraint-preservation",
            minimumScore: 2,
            guidance: "Keep the durable path, URL, and rerun command exact while avoiding raw repetition.",
            positiveSignals: ["Exact path", "Exact command", "Single URL mention"],
            failureSignals: ["Mutated literals", "Repeats noisy lines verbatim several times"],
          },
          {
            facetId: "evidence-use",
            minimumScore: 3,
            guidance: "Use the repeated warning plus cache-wait signal to justify the likely cause.",
            positiveSignals: ["Connects warning repetition to cache or retry issue"],
            failureSignals: ["Invents unrelated root cause"],
          },
          {
            facetId: "actionability",
            minimumScore: 2,
            guidance: "Give one actionable rerun or verification step tied to the cited test surface.",
            positiveSignals: ["Runnable rerun command", "Specific next check"],
            failureSignals: ["No concrete follow-up"],
          },
        ],
      },
    },
    {
      caseId: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS[2],
      caseType: "comparison",
      title: "Contextual answer synthesizes selected context with preserved invariants",
      optimizationLevel: "contextual",
      expectedOutcome:
        "A comparison answer that explains what must stay exact in selected context, what can be compressed, and why the preserved markers matter.",
      prompt: {
        systemInstruction:
          "You are comparing preserved versus compressible selected-context content. Answer with two bullets: preserved invariants, then compressible context.",
        surfaces: {
          latestUserMessage: "Explain which selected-context details must survive compression and which repeated notes can shrink safely.",
          runtimeOwnedSections: [], toolOutputs: [],
          selectedContext: [
            "<!-- wunderkind:selected-context-start -->", "Repeated diagnosis note: preserve the causal chain before proposing changes.",
            "Repeated diagnosis note: preserve the causal chain before proposing changes.", "<!-- wunderkind:selected-context-preserve-start -->",
            "Path: src/runtime-transcript-compression.ts", "$ bun test tests/unit/prompt-optimization-level-fixture.test.ts",
            "See https://example.com/context-spec for the selected-context contract", "<!-- wunderkind:selected-context-preserve-end -->",
            "Repeated diagnosis note: preserve the causal chain before proposing changes.",
          ],
          retainedHistory: [], transcriptWideCompaction: [],
        },
      },
      rubric: {
        scale: PROMPT_ANSWER_QUALITY_RUBRIC_SCORES, passingScore: 10, maximumScore: 16,
        facets: [
          {
            facetId: "instruction-following",
            minimumScore: 2,
            guidance: "Use exactly two bullets in the requested order.",
            positiveSignals: ["Two bullets", "Correct bullet order"],
            failureSignals: ["Paragraph format", "Wrong ordering"],
          },
          {
            facetId: "constraint-preservation",
            minimumScore: 3,
            guidance: "Treat the preserve-start/end span, path, command, and URL as exact invariants.",
            positiveSignals: ["Mentions preserved span", "Keeps exact literals"],
            failureSignals: ["Compresses protected literals", "Drops preserve markers entirely"],
          },
          {
            facetId: "evidence-use",
            minimumScore: 3,
            guidance: "Use the repeated diagnosis note as the evidence for what is safe to compress.",
            positiveSignals: ["Calls out repeated note as shrinkable"],
            failureSignals: ["Claims all selected context is equally mutable"],
          },
          {
            facetId: "actionability",
            minimumScore: 2,
            guidance: "Make the preservation rule easy for an engineer to apply during future compression work.",
            positiveSignals: ["Clear preserve-versus-compress rule"],
            failureSignals: ["Abstract answer with no decision rule"],
          },
        ],
      },
    },
    {
      caseId: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS[3],
      caseType: "synthesis",
      title: "Transcript answer reconciles retained history with the latest request",
      optimizationLevel: "transcript",
      expectedOutcome:
        "A synthesis answer that preserves the latest request verbatim, respects protected earlier history, and states what the transcript compressor may shorten.",
      prompt: {
        systemInstruction:
          "You are reconciling transcript history with the latest request. Answer with three bullets: latest request, protected history, compressible history.",
        surfaces: {
          latestUserMessage: "Latest request must remain untouched.",
          runtimeOwnedSections: [],
          toolOutputs: [],
          selectedContext: [],
          retainedHistory: [
            "Earlier retained history summary. Earlier retained history summary.",
            "Assistant synthesis still pending. Assistant synthesis still pending.",
          ],
          transcriptWideCompaction: [
            "Repeated earlier diagnosis line. Repeated earlier diagnosis line.",
            "Background task id: bg_transcript123 remains session-local.",
            'Quoted user example: "keep this quote exact".',
            "Path: src/runtime-user-prompt-optimization.ts",
          ],
        },
      },
      rubric: {
        scale: PROMPT_ANSWER_QUALITY_RUBRIC_SCORES, passingScore: 10, maximumScore: 16,
        facets: [
          {
            facetId: "instruction-following",
            minimumScore: 2,
            guidance: "Use exactly three bullets matching the requested categories.",
            positiveSignals: ["Three bullets", "Latest/protected/compressible categories present"],
            failureSignals: ["Missing category", "Free-form paragraph"],
          },
          {
            facetId: "constraint-preservation",
            minimumScore: 3,
            guidance: "Preserve the latest request, background task id, quoted example, and file path exactly.",
            positiveSignals: ["Latest request quoted exactly", "Protected history quoted exactly"],
            failureSignals: ["Mutates latest request", "Drops protected history literals"],
          },
          {
            facetId: "evidence-use",
            minimumScore: 3,
            guidance: "Use the repeated retained-history lines as the evidence for what is compressible.",
            positiveSignals: ["Identifies repeated summaries as shrinkable"],
            failureSignals: ["Treats protected history as compressible"],
          },
          {
            facetId: "actionability",
            minimumScore: 2,
            guidance: "Give a practical compression rule an engineer can apply to future transcript history.",
            positiveSignals: ["Practical compress-versus-preserve rule"],
            failureSignals: ["No operational takeaway"],
          },
        ],
      },
    },
  ],
}
