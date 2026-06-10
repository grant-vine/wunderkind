export const PRIMARY_PROJECT_ARTIFACT_DIR = ".omo" as const
export const LEGACY_PROJECT_ARTIFACT_DIR = ".sisyphus" as const

export const PRIMARY_PROJECT_ARTIFACT_PATHS = {
  root: PRIMARY_PROJECT_ARTIFACT_DIR,
  plans: `${PRIMARY_PROJECT_ARTIFACT_DIR}/plans`,
  notepads: `${PRIMARY_PROJECT_ARTIFACT_DIR}/notepads`,
  evidence: `${PRIMARY_PROJECT_ARTIFACT_DIR}/evidence`,
} as const

export const LEGACY_PROJECT_ARTIFACT_PATHS = {
  root: LEGACY_PROJECT_ARTIFACT_DIR,
  plans: `${LEGACY_PROJECT_ARTIFACT_DIR}/plans`,
  notepads: `${LEGACY_PROJECT_ARTIFACT_DIR}/notepads`,
  evidence: `${LEGACY_PROJECT_ARTIFACT_DIR}/evidence`,
} as const

export function mapLegacyArtifactPathToPrimary(relativePath: string): string {
  if (relativePath === LEGACY_PROJECT_ARTIFACT_DIR) {
    return PRIMARY_PROJECT_ARTIFACT_DIR
  }

  const legacyPrefix = `${LEGACY_PROJECT_ARTIFACT_DIR}/`
  if (relativePath.startsWith(legacyPrefix)) {
    return `${PRIMARY_PROJECT_ARTIFACT_DIR}/${relativePath.slice(legacyPrefix.length)}`
  }

  return relativePath
}

export function isPrimaryAppendOnlyArtifactPath(relativePath: string): boolean {
  return relativePath.startsWith(`${PRIMARY_PROJECT_ARTIFACT_PATHS.notepads}/`)
    || relativePath.startsWith(`${PRIMARY_PROJECT_ARTIFACT_PATHS.evidence}/`)
}
