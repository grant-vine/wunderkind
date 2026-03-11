import type { DocHistoryMode } from "./types.js"

export interface PersonalityMeta {
  label: string
  hint: string
}

export const PERSONALITY_META: Record<
  | "teamCulture"
  | "orgStructure"
  | "ciso"
  | "cto"
  | "cmo"
  | "qa"
  | "product"
  | "ops"
  | "creative"
  | "brand"
  | "devrel"
  | "legal"
  | "support"
  | "dataAnalyst",
  Record<string, PersonalityMeta>
> = {
  teamCulture: {
    "formal-strict": {
      label: "formal-strict",
      hint: "Structured, policy-heavy, rigorous tone",
    },
    "pragmatic-balanced": {
      label: "pragmatic-balanced",
      hint: "Default balanced execution style",
    },
    "experimental-informal": {
      label: "experimental-informal",
      hint: "Fast-moving, exploratory, informal",
    },
  },
  orgStructure: {
    flat: {
      label: "flat",
      hint: "Peer collaboration and user escalation",
    },
    hierarchical: {
      label: "hierarchical",
      hint: "Domain authority with explicit veto paths",
    },
  },
  ciso: {
    "paranoid-enforcer": {
      label: "paranoid-enforcer",
      hint: "Maximum threat paranoia; blocks anything unproven",
    },
    "pragmatic-risk-manager": {
      label: "pragmatic-risk-manager",
      hint: "Balances risk vs. velocity; default posture",
    },
    "educator-collaborator": {
      label: "educator-collaborator",
      hint: "Guides teams through security thinking collaboratively",
    },
  },
  cto: {
    "grizzled-sysadmin": {
      label: "grizzled-sysadmin",
      hint: "Battle-hardened ops mindset; stability over novelty",
    },
    "startup-bro": {
      label: "startup-bro",
      hint: "Move fast; bias toward shipping",
    },
    "code-archaeologist": {
      label: "code-archaeologist",
      hint: "Deep digs into legacy systems; explains history",
    },
  },
  cmo: {
    "data-driven": {
      label: "data-driven",
      hint: "Metrics and attribution first; no vanity metrics",
    },
    "brand-storyteller": {
      label: "brand-storyteller",
      hint: "Narrative and emotional resonance over raw data",
    },
    "growth-hacker": {
      label: "growth-hacker",
      hint: "Experiments, loops, and funnel obsession",
    },
  },
  qa: {
    "rule-enforcer": {
      label: "rule-enforcer",
      hint: "Strict standards; gates every release",
    },
    "risk-based-pragmatist": {
      label: "risk-based-pragmatist",
      hint: "Tests what matters most; ships with confidence",
    },
    "rubber-duck": {
      label: "rubber-duck",
      hint: "Walks devs through their own bugs; collaborative",
    },
  },
  product: {
    "user-advocate": {
      label: "user-advocate",
      hint: "User pain and delight over internal efficiency",
    },
    "velocity-optimizer": {
      label: "velocity-optimizer",
      hint: "Throughput and cycle time over perfect specs",
    },
    "outcome-obsessed": {
      label: "outcome-obsessed",
      hint: "Business outcomes and measurable impact first",
    },
  },
  ops: {
    "on-call-veteran": {
      label: "on-call-veteran",
      hint: "Incident-hardened; runbook-first",
    },
    "efficiency-maximiser": {
      label: "efficiency-maximiser",
      hint: "Automates everything; cost and throughput focused",
    },
    "process-purist": {
      label: "process-purist",
      hint: "Change management and process integrity",
    },
  },
  creative: {
    "perfectionist-craftsperson": {
      label: "perfectionist-craftsperson",
      hint: "Pixel-perfect; never ships unpolished",
    },
    "bold-provocateur": {
      label: "bold-provocateur",
      hint: "Intentionally disruptive visual choices",
    },
    "pragmatic-problem-solver": {
      label: "pragmatic-problem-solver",
      hint: "Design that ships; form follows function",
    },
  },
  brand: {
    "community-evangelist": {
      label: "community-evangelist",
      hint: "Builds through authentic community engagement",
    },
    "pr-spinner": {
      label: "pr-spinner",
      hint: "Narrative control and media-savvy messaging",
    },
    "authentic-builder": {
      label: "authentic-builder",
      hint: "No spin; build trust through radical transparency",
    },
  },
  devrel: {
    "community-champion": {
      label: "community-champion",
      hint: "Forum presence, events, OSS contribution",
    },
    "docs-perfectionist": {
      label: "docs-perfectionist",
      hint: "Every API documented; no gaps tolerated",
    },
    "dx-engineer": {
      label: "dx-engineer",
      hint: "Developer experience as a product; DX metrics",
    },
  },
  legal: {
    "cautious-gatekeeper": {
      label: "cautious-gatekeeper",
      hint: "Blocks anything legally ambiguous",
    },
    "pragmatic-advisor": {
      label: "pragmatic-advisor",
      hint: "Risk-calibrated; enables the business to move",
    },
    "plain-english-counselor": {
      label: "plain-english-counselor",
      hint: "Translates legalese into plain language",
    },
  },
  support: {
    "empathetic-resolver": {
      label: "empathetic-resolver",
      hint: "Treats every ticket as a relationship",
    },
    "systematic-triage": {
      label: "systematic-triage",
      hint: "Classification, routing, and severity-driven",
    },
    "knowledge-builder": {
      label: "knowledge-builder",
      hint: "Every fix becomes a doc; knowledge loop focus",
    },
  },
  dataAnalyst: {
    "rigorous-statistician": {
      label: "rigorous-statistician",
      hint: "Significance, confidence intervals, no p-hacking",
    },
    "insight-storyteller": {
      label: "insight-storyteller",
      hint: "Translates data into narratives for decisions",
    },
    "pragmatic-quant": {
      label: "pragmatic-quant",
      hint: "Good-enough analysis fast; directional signals",
    },
  },
}

export const DOCS_HISTORY_META: Record<DocHistoryMode, PersonalityMeta> = {
  overwrite: {
    label: "overwrite",
    hint: "Replaces the file each time (default)",
  },
  "append-dated": {
    label: "append-dated",
    hint: "Appends a new dated section",
  },
  "new-dated-file": {
    label: "new-dated-file",
    hint: "Creates a new file with a date suffix",
  },
  "overwrite-archive": {
    label: "overwrite-archive",
    hint: "Overwrites and archives the previous version",
  },
}
