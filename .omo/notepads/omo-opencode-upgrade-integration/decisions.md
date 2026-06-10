
## 2026-05-15 docs/bootstrap decisions
- Treat `CONTEXT.md` as part of the standard Wunderkind bootstrap contract for this repo, not a speculative future artifact.
- Use the managed docs lane model (`docs/README.md` + five canonical agent docs) to represent latest repo truth after the `v0.17.0` release.
- Keep this repo on `docHistoryMode: overwrite` for now so the managed docs set stays canonical rather than append-heavy.
- Preserve canonical `oh-my-openagent` naming in docs while explicitly acknowledging legacy `oh-my-opencode` compatibility where the repo contract still promises it.
