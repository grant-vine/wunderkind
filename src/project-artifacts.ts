export const PRIMARY_PROJECT_ARTIFACT_DIR = ".omo" as const
export const LEGACY_PROJECT_ARTIFACT_DIR = ".sisyphus" as const
export const LEGACY_PROJECT_ARTIFACT_MESSAGE =
  ".sisyphus/ is no longer an active Wunderkind artifact root. Move durable project artifacts into .omo/ and use .omo/notepads/ or .omo/evidence/." as const

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

export function isLegacyProjectArtifactPath(relativePath: string): boolean {
  return relativePath === LEGACY_PROJECT_ARTIFACT_DIR || relativePath.startsWith(`${LEGACY_PROJECT_ARTIFACT_DIR}/`)
}

export function assertActiveProjectArtifactPath(relativePath: string): void {
  if (isLegacyProjectArtifactPath(relativePath)) {
    throw new Error(LEGACY_PROJECT_ARTIFACT_MESSAGE)
  }
}

export function isPrimaryAppendOnlyArtifactPath(relativePath: string): boolean {
  return relativePath.startsWith(`${PRIMARY_PROJECT_ARTIFACT_PATHS.notepads}/`)
    || relativePath.startsWith(`${PRIMARY_PROJECT_ARTIFACT_PATHS.evidence}/`)
}
