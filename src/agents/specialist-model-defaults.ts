export const WUNDERKIND_SPECIALIST_MODEL_DEFAULTS = {
  "marketing-wunderkind": { codexId: "wunderkind-marketing", model: "gpt-6.1-terra", modelReasoningEffort: "high" },
  "creative-director": { codexId: "wunderkind-creative-director", model: "gpt-6.1-terra", modelReasoningEffort: "high" },
  "product-wunderkind": { codexId: "wunderkind-product", model: "gpt-6.1-sol", modelReasoningEffort: "high" },
  "fullstack-wunderkind": { codexId: "wunderkind-architecture", model: "gpt-6.1-sol", modelReasoningEffort: "high" },
  ciso: { codexId: "wunderkind-ciso", model: "gpt-6.1-sol", modelReasoningEffort: "high" },
  "legal-counsel": { codexId: "wunderkind-legal", model: "gpt-6.1-sol", modelReasoningEffort: "high" },
} as const

export function specialistModelDefaultsForOpenCode(id: string): { readonly model: string; readonly variant: string } {
  const route = Object.entries(WUNDERKIND_SPECIALIST_MODEL_DEFAULTS).find(([candidate]) => candidate === id)?.[1]
  if (route === undefined) throw new Error(`Unknown Wunderkind specialist: ${id}`)
  return { model: `openai/${route.model}`, variant: route.modelReasoningEffort }
}

export function specialistModelDefaultsForCodex(id: string): { readonly model: string; readonly modelReasoningEffort: string } {
  const route = Object.values(WUNDERKIND_SPECIALIST_MODEL_DEFAULTS).find((candidate) => candidate.codexId === id)
  if (route === undefined) throw new Error(`Unknown Wunderkind Codex specialist: ${id}`)
  return { model: route.model, modelReasoningEffort: route.modelReasoningEffort }
}
