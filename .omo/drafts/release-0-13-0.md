# Draft: Release 0.13.0

## Requirements (confirmed)
- bump versions (0.13.0 I think)
- push for npm release

## Technical Decisions
- Treat this as a release-planning request, not execution
- Verify exact version sync points and tag-based publish workflow before finalizing plan

## Research Findings
- `package.json` contains the primary package version field (currently 0.12.1)
- `.claude-plugin/plugin.json` must be manually kept in sync with `package.json`
- `CHANGELOG.md` carries release notes and needs a new top entry for the release
- `.github/workflows/publish.yml` publishes on `v*` tag push via GitHub Actions
- `package.json` scripts: `bun run build`, `bun test tests/unit/`, `prepublishOnly` runs `bun run build`

## Open Questions
- Confirm target version is exactly 0.13.0
- Confirm whether release should proceed as the standard tag-driven publish flow: commit bump, push branch, then push `v0.13.0`

## Scope Boundaries
- INCLUDE: version bump planning, sync surfaces, verification, push/release path
- EXCLUDE: direct execution in this planning phase
