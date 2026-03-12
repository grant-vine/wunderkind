import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  createMarketingWunderkindAgent,
  createCreativeDirectorAgent,
  createProductWunderkindAgent,
  createFullstackWunderkindAgent,
  createBrandBuilderAgent,
  createQaSpecialistAgent,
  createOperationsLeadAgent,
  createCisoAgent,
  createDevrelWunderkindAgent,
  DEVREL_WUNDERKIND_METADATA,
  createLegalCounselAgent,
  LEGAL_COUNSEL_METADATA,
  createDataAnalystAgent,
  DATA_ANALYST_METADATA,
  createSupportEngineerAgent,
  SUPPORT_ENGINEER_METADATA,
} from "../../src/agents/index.js"

const NEW_AGENTS = [
  {
    name: "devrel-wunderkind",
    factory: createDevrelWunderkindAgent,
    metadata: DEVREL_WUNDERKIND_METADATA,
    heading: "# DevRel Wunderkind",
    hasSubSkillDelegation: true,
  },
  {
    name: "legal-counsel",
    factory: createLegalCounselAgent,
    metadata: LEGAL_COUNSEL_METADATA,
    heading: "# Legal Counsel",
    hasSubSkillDelegation: false,
  },
  {
    name: "data-analyst",
    factory: createDataAnalystAgent,
    metadata: DATA_ANALYST_METADATA,
    heading: "# Data Analyst",
    hasSubSkillDelegation: true,
  },
  {
    name: "support-engineer",
    factory: createSupportEngineerAgent,
    metadata: SUPPORT_ENGINEER_METADATA,
    heading: "# Support Engineer",
    hasSubSkillDelegation: false,
  },
] as const

describe("New agent factory structure", () => {
  for (const { name, factory, metadata, heading } of NEW_AGENTS) {
    describe(name, () => {
      const config = factory("test-model")

      it("description is still keyword-rich for routing", () => {
        expect(config.description).toMatch(/^USE FOR:/)
      })

      it("description is at least 100 characters", () => {
        expect((config.description ?? "").length).toBeGreaterThan(100)
      })

      it("prompt references resolved runtime context", () => {
        expect(config.prompt).toContain("Before acting, read")
      })

      it("prompt contains agent heading", () => {
        expect(config.prompt).toContain(heading)
      })

      it("model equals the passed-in model", () => {
        expect(config.model).toBe("test-model")
      })

      it("mode is all", () => {
        expect(factory.mode).toBe("all")
      })

      it("metadata triggers is non-empty", () => {
        expect(metadata.triggers.length).toBeGreaterThan(0)
      })

      it("metadata triggers[0].domain is defined", () => {
        expect(metadata.triggers[0]?.domain).toBeDefined()
      })

      it("prompt contains personality key reference", () => {
        expect(config.prompt).toMatch(/Personality/)
      })

      it("prompt references OpenCode orchestrated workflow context", () => {
        expect(config.prompt).toContain("OpenCode orchestrated workflow")
      })

      it("prompt contains .sisyphus/ persistent context section", () => {
        expect(config.prompt).toContain(".sisyphus/")
      })
    })
  }

  describe("support-engineer has no sub-skill delegation section", () => {
    it("support-engineer prompt does not contain 'Sub-Skill'", () => {
      const config = createSupportEngineerAgent("test-model")
      expect(config.prompt).not.toContain("Sub-Skill")
    })
  })

  describe("tool deny lists", () => {
    it("legal-counsel denies task", () => {
      const config = createLegalCounselAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBe("deny")
    })

    it("data-analyst denies task", () => {
      const config = createDataAnalystAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBe("deny")
    })

    it("devrel-wunderkind denies task", () => {
      const config = createDevrelWunderkindAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBe("deny")
    })

    it("support-engineer does NOT deny task", () => {
      const config = createSupportEngineerAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBeUndefined()
    })
  })

  describe("no personality keys in wrong agents (sanity)", () => {
    it("all 4 new agents have a personality config key (full personality system)", () => {
      for (const { factory } of NEW_AGENTS) {
        const config = factory("m")
        expect(config.prompt).toMatch(/Personality/)
      }
    })
  })
})

describe("all shipped wunderkind specialists are directly usable and delegatable", () => {
  const ALL_SPECIALISTS = [
    ["marketing-wunderkind", createMarketingWunderkindAgent],
    ["creative-director", createCreativeDirectorAgent],
    ["product-wunderkind", createProductWunderkindAgent],
    ["fullstack-wunderkind", createFullstackWunderkindAgent],
    ["brand-builder", createBrandBuilderAgent],
    ["qa-specialist", createQaSpecialistAgent],
    ["operations-lead", createOperationsLeadAgent],
    ["ciso", createCisoAgent],
    ["devrel-wunderkind", createDevrelWunderkindAgent],
    ["legal-counsel", createLegalCounselAgent],
    ["data-analyst", createDataAnalystAgent],
    ["support-engineer", createSupportEngineerAgent],
  ] as const

  for (const [name, factory] of ALL_SPECIALISTS) {
    it(`${name} factory mode is all`, () => {
      expect(factory.mode).toBe("all")
    })

    it(`${name} generated markdown frontmatter uses mode all`, () => {
      const markdown = readFileSync(join(process.cwd(), "agents", `${name}.md`), "utf-8")
      expect(markdown).toContain("mode: all")
      expect(markdown).not.toContain("mode: primary")
    })
  }
})

describe("Documentation Output static sections", () => {
  const ELIGIBLE_AGENT_FACTORIES = [
    { name: "marketing-wunderkind", factory: createMarketingWunderkindAgent },
    { name: "creative-director", factory: createCreativeDirectorAgent },
    { name: "product-wunderkind", factory: createProductWunderkindAgent },
    { name: "fullstack-wunderkind", factory: createFullstackWunderkindAgent },
    { name: "brand-builder", factory: createBrandBuilderAgent },
    { name: "qa-specialist", factory: createQaSpecialistAgent },
    { name: "operations-lead", factory: createOperationsLeadAgent },
    { name: "ciso", factory: createCisoAgent },
    { name: "devrel-wunderkind", factory: createDevrelWunderkindAgent },
  ]

  for (const { name, factory } of ELIGIBLE_AGENT_FACTORIES) {
    it(`${name} does NOT contain the old static documentation block`, () => {
      const config = factory("test-model")
      expect(config.prompt).not.toContain("## Documentation Output (Static Reference)")
    })
  }

  const EXCLUDED_AGENT_FACTORIES = [
    { name: "legal-counsel", factory: createLegalCounselAgent },
    { name: "support-engineer", factory: createSupportEngineerAgent },
    { name: "data-analyst", factory: createDataAnalystAgent },
  ]

  for (const { name, factory } of EXCLUDED_AGENT_FACTORIES) {
    it(`${name} does NOT contain ## Documentation Output (Static Reference)`, () => {
      const config = factory("test-model")
      expect(config.prompt).not.toContain(
        "## Documentation Output (Static Reference)",
      )
    })
  }
})
