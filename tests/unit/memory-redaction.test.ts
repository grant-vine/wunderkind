import { describe, expect, it } from "bun:test"
import { redactExcerpt } from "../../src/memory/redaction.js"

describe("memory canonical redaction", () => {
  it("removes assignment, bearer, provider token, and connection credential values before storage boundaries", () => {
    // Given: representative protected values from an untrusted capture payload.
    const excerpt = "api_key=example-secret Authorization: Bearer bearer-secret token=token-secret ghp_exampletoken DATABASE_URL=postgres://alice:connection-secret@db.example/app postgres://admin:uri-secret@db.example/app"

    // When: the memory boundary normalizes the payload.
    const redacted = redactExcerpt(excerpt)

    // Then: no protected value survives the canonical redactor.
    expect(redacted).not.toContain("example-secret")
    expect(redacted).not.toContain("bearer-secret")
    expect(redacted).not.toContain("token-secret")
    expect(redacted).not.toContain("ghp_exampletoken")
    expect(redacted).not.toContain("connection-secret")
    expect(redacted).not.toContain("uri-secret")
  })
})
