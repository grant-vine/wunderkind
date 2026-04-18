# Draft: Release 0.15.0

## Summary
- modernize Wunderkind around canonical `oh-my-openagent` config basenames while preserving legacy `oh-my-opencode` fallback support
- centralize OMO readiness and freshness checks so `doctor`, `install`, `upgrade`, and the TUI installer share one compatibility path
- ship a canonical `oh-my-openagent.jsonc` template asset, keep the legacy compatibility template for transition, and align packaging/docs with the new install behavior

## Verification
- `bun test tests/unit/` ✅
- `bun run build` ✅
- LSP diagnostics on changed source/tests ✅

## Release Notes
### Added
- canonical `oh-my-openagent.jsonc` root template asset for new setups

### Changed
- canonical-first OMO config detection with legacy fallback
- shared installer/doctor OMO readiness and freshness guidance
- TUI bootstrap behavior now checks for OMO first and can auto-run the upstream installer when available
- package publish surface now includes both canonical and legacy OMO templates

### Compatibility
- continue probing upstream via `bunx oh-my-opencode ...` until the package/CLI naming changes upstream
- retain `oh-my-opencode.jsonc` for one transition window so existing automation keeps working
