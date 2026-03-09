import { describe, it, expect } from "bun:test"
import {
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

      it("description starts with USE FOR:", () => {
        expect(config.description).toMatch(/^USE FOR:/)
      })

      it("description is at least 100 characters", () => {
        expect((config.description ?? "").length).toBeGreaterThan(100)
      })

      it("prompt references wunderkind.config.jsonc", () => {
        expect(config.prompt).toContain("wunderkind.config.jsonc")
      })

      it("prompt contains agent heading", () => {
        expect(config.prompt).toContain(heading)
      })

      it("model equals the passed-in model", () => {
        expect(config.model).toBe("test-model")
      })

      it("mode is primary", () => {
        expect(factory.mode).toBe("primary")
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

    it("devrel-wunderkind does NOT deny task", () => {
      const config = createDevrelWunderkindAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBeUndefined()
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
