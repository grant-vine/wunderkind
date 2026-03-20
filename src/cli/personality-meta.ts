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
  | "product"
  | "creative"
  | "legal",
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
      hint: "Balances risk, incident urgency, compliance impact, and delivery speed; default posture",
    },
    "educator-collaborator": {
      label: "educator-collaborator",
      hint: "Guides teams through security thinking, incident posture, and compliance tradeoffs collaboratively",
    },
  },
  cto: {
    "grizzled-sysadmin": {
      label: "grizzled-sysadmin",
      hint: "Battle-hardened ops mindset; stability, runbooks, supportability, and regression proof over novelty",
    },
    "startup-bro": {
      label: "startup-bro",
      hint: "Move fast; bias toward shipping, direct technical triage, and pragmatic test depth when risk permits",
    },
    "code-archaeologist": {
      label: "code-archaeologist",
      hint: "Deep digs into legacy systems, flaky tests, and recurring incident history before changing architecture",
    },
  },
  cmo: {
    "data-driven": {
      label: "data-driven",
      hint: "Metrics, attribution, community health, docs adoption, activation, and TTFV first; no vanity metrics",
    },
    "brand-storyteller": {
      label: "brand-storyteller",
      hint: "Narrative, PR trust-building, thought leadership, and developer education over raw data alone",
    },
    "growth-hacker": {
      label: "growth-hacker",
      hint: "Experiments, onboarding loops, docs-led adoption, community flywheels, and funnel obsession",
    },
  },
  product: {
    "user-advocate": {
      label: "user-advocate",
      hint: "User pain, issue clarity, adoption friction, and acceptance quality over internal efficiency",
    },
    "velocity-optimizer": {
      label: "velocity-optimizer",
      hint: "Throughput, backlog-ready triage, and rapid experiment cadence over perfect specs",
    },
    "outcome-obsessed": {
      label: "outcome-obsessed",
      hint: "Business outcomes, acceptance rigor, issue intake quality, and usage-driven prioritization first",
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
}

export const DOCS_HISTORY_META: Record<DocHistoryMode, PersonalityMeta> = {
  overwrite: {
    label: "overwrite",
    hint: "Replaces the file each time (default)",
  },
  "append-dated": {
    label: "append-dated",
    hint: "Appends a new UTC-timestamped section",
  },
  "new-dated-file": {
    label: "new-dated-file",
    hint: "Creates a new UTC-timestamped file",
  },
  "overwrite-archive": {
    label: "overwrite-archive",
    hint: "Overwrites and archives the previous version",
  },
}
