import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  createMarketingWunderkindAgent,
  MARKETING_WUNDERKIND_METADATA,
  createCreativeDirectorAgent,
  CREATIVE_DIRECTOR_METADATA,
  createProductWunderkindAgent,
  PRODUCT_WUNDERKIND_METADATA,
  createFullstackWunderkindAgent,
  FULLSTACK_WUNDERKIND_METADATA,
  createCisoAgent,
  CISO_METADATA,
  createLegalCounselAgent,
  LEGAL_COUNSEL_METADATA,
} from "../../src/agents/index.js"
import { RETAINED_AGENT_SLASH_COMMANDS } from "../../src/agents/slash-commands.js"

const RETAINED_SPECIALISTS = [
  {
    name: "marketing-wunderkind",
    factory: createMarketingWunderkindAgent,
    metadata: MARKETING_WUNDERKIND_METADATA,
    heading: "# Marketing Wunderkind — Soul",
  },
  {
    name: "creative-director",
    factory: createCreativeDirectorAgent,
    metadata: CREATIVE_DIRECTOR_METADATA,
    heading: "# Creative Director — Soul",
  },
  {
    name: "product-wunderkind",
    factory: createProductWunderkindAgent,
    metadata: PRODUCT_WUNDERKIND_METADATA,
    heading: "# Product Wunderkind — Soul",
  },
  {
    name: "fullstack-wunderkind",
    factory: createFullstackWunderkindAgent,
    metadata: FULLSTACK_WUNDERKIND_METADATA,
    heading: "# Fullstack Wunderkind — Soul",
  },
  {
    name: "ciso",
    factory: createCisoAgent,
    metadata: CISO_METADATA,
    heading: "# CISO — Soul",
  },
  {
    name: "legal-counsel",
    factory: createLegalCounselAgent,
    metadata: LEGAL_COUNSEL_METADATA,
    heading: "# Legal Counsel — Soul",
  },
] as const

describe("retained agent factory structure", () => {
  for (const { name, factory, metadata, heading } of RETAINED_SPECIALISTS) {
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

      it("prompt contains .sisyphus/ persistent context section", () => {
        expect(config.prompt).toContain(".sisyphus/")
      })

      it("prompt contains SOUL maintenance guidance", () => {
        expect(config.prompt).toContain("## SOUL Maintenance (.wunderkind/souls/)")
        expect(config.prompt).toContain("remember something durable")
      })

      it("prompt contains shared slash-command help contract", () => {
        expect(config.prompt).toContain("Every slash command must support a `--help` form.")
        expect(config.prompt).toContain("run `/<command> --help`")
      })

      it("prompt contains all registered slash commands for the agent", () => {
        const registry = RETAINED_AGENT_SLASH_COMMANDS[name]
        if (!registry) return

        for (const command of registry.commands) {
          expect(config.prompt).toContain(`### \`${command.command}\``)
        }
      })
    })
  }

  describe("tool deny lists", () => {
    it("legal-counsel denies task", () => {
      const config = createLegalCounselAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBe("deny")
    })

    it("marketing-wunderkind denies task", () => {
      const config = createMarketingWunderkindAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBe("deny")
    })

    it("creative-director denies task", () => {
      const config = createCreativeDirectorAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBe("deny")
    })

    it("fullstack-wunderkind does NOT deny task", () => {
      const config = createFullstackWunderkindAgent("test-model")
      const permissions = config.permission as Record<string, string> | undefined
      expect(permissions?.["task"]).toBeUndefined()
    })
  })
})

describe("all shipped wunderkind specialists are directly usable and delegatable", () => {
  const ALL_SPECIALISTS = [
    ["marketing-wunderkind", createMarketingWunderkindAgent],
    ["creative-director", createCreativeDirectorAgent],
    ["product-wunderkind", createProductWunderkindAgent],
    ["fullstack-wunderkind", createFullstackWunderkindAgent],
    ["ciso", createCisoAgent],
    ["legal-counsel", createLegalCounselAgent],
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
    { name: "ciso", factory: createCisoAgent },
  ]

  for (const { name, factory } of ELIGIBLE_AGENT_FACTORIES) {
    it(`${name} does NOT contain the old static documentation block`, () => {
      const config = factory("test-model")
      expect(config.prompt).not.toContain("## Documentation Output (Static Reference)")
    })
  }

  const EXCLUDED_AGENT_FACTORIES = [
    { name: "legal-counsel", factory: createLegalCounselAgent },
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
