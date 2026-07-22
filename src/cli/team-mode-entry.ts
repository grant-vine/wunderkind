import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import { DEFAULT_WUNDERKIND_TEAM_NAME } from "./team-bootstrap.js"

export const WUNDERKIND_TEAM_ENTRY_COMMAND = "/wunderkind-team" as const
export const WUNDERKIND_TEAM_ENTRY_OPENER = "What do you want to do today?" as const
export const WUNDERKIND_TEAM_MODE_ENABLEMENT_KEY = "team_mode.enabled" as const

export type WunderkindTeamModeConfigScope = "project" | "global"
export type WunderkindTeamModeConfigFormat = "json" | "jsonc"
export type WunderkindTeamSpecScope = "project" | "user"
export type WunderkindTeamEntryStatus = "team-ready" | "team-mode-disabled" | "team-spec-missing"

interface CanonicalTeamModeConfigPath {
  readonly path: string
  readonly scope: WunderkindTeamModeConfigScope
  readonly format: WunderkindTeamModeConfigFormat
}

interface ParsedTeamModeConfig {
  readonly team_mode?: {
    readonly enabled?: boolean
  }
}

export interface WunderkindTeamEntryState {
  readonly command: typeof WUNDERKIND_TEAM_ENTRY_COMMAND
  readonly opener: typeof WUNDERKIND_TEAM_ENTRY_OPENER
  readonly teamName: string
  readonly status: WunderkindTeamEntryStatus
  readonly teamModeEnabled: boolean
  readonly checkedConfigPaths: readonly CanonicalTeamModeConfigPath[]
  readonly activeConfigPath: string | null
  readonly activeConfigScope: WunderkindTeamModeConfigScope | null
  readonly activeConfigFormat: WunderkindTeamModeConfigFormat | null
  readonly projectTeamSpecPath: string
  readonly userTeamSpecPath: string
  readonly availableTeamSpecPath: string | null
  readonly availableTeamSpecScope: WunderkindTeamSpecScope | null
}

export interface ResolveWunderkindTeamEntryStateOptions {
  readonly cwd?: string
  readonly homeDir?: string
  readonly teamName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getCanonicalTeamModeConfigPaths(cwd: string, homeDir: string): readonly CanonicalTeamModeConfigPath[] {
  return [
    {
      path: join(cwd, ".opencode", "oh-my-openagent.jsonc"),
      scope: "project",
      format: "jsonc",
    },
    {
      path: join(cwd, ".opencode", "oh-my-openagent.json"),
      scope: "project",
      format: "json",
    },
    {
      path: join(homeDir, ".config", "opencode", "oh-my-openagent.jsonc"),
      scope: "global",
      format: "jsonc",
    },
    {
      path: join(homeDir, ".config", "opencode", "oh-my-openagent.json"),
      scope: "global",
      format: "json",
    },
  ] as const
}

function readParsedTeamModeConfig(filePath: string): ParsedTeamModeConfig | null {
  try {
    const parsed = parseJsonc(readFileSync(filePath, "utf-8")) as unknown
    return isRecord(parsed) ? (parsed as ParsedTeamModeConfig) : null
  } catch {
    return null
  }
}

function isTeamModeEnabled(parsed: ParsedTeamModeConfig | null): boolean {
  return parsed?.team_mode?.enabled === true
}

export function resolveWunderkindTeamEntryState(
  options: ResolveWunderkindTeamEntryStateOptions = {},
): WunderkindTeamEntryState {
  const cwd = options.cwd ?? process.cwd()
  const homeDir = options.homeDir ?? process.env.HOME ?? process.env.USERPROFILE ?? homedir()
  const teamName = options.teamName ?? DEFAULT_WUNDERKIND_TEAM_NAME
  const checkedConfigPaths = getCanonicalTeamModeConfigPaths(cwd, homeDir)
  const activeConfig = checkedConfigPaths.find((candidate) => existsSync(candidate.path)) ?? null
  const teamModeEnabled = activeConfig !== null && isTeamModeEnabled(readParsedTeamModeConfig(activeConfig.path))
  const projectTeamSpecPath = join(cwd, ".omo", "teams", teamName, "config.json")
  const userTeamSpecPath = join(homeDir, ".omo", "teams", teamName, "config.json")
  const projectTeamSpecPresent = existsSync(projectTeamSpecPath)
  const userTeamSpecPresent = existsSync(userTeamSpecPath)
  const availableTeamSpecPath = projectTeamSpecPresent ? projectTeamSpecPath : userTeamSpecPresent ? userTeamSpecPath : null
  const availableTeamSpecScope = projectTeamSpecPresent ? "project" : userTeamSpecPresent ? "user" : null
  const status: WunderkindTeamEntryStatus = !teamModeEnabled
    ? "team-mode-disabled"
    : availableTeamSpecPath === null
      ? "team-spec-missing"
      : "team-ready"

  return {
    command: WUNDERKIND_TEAM_ENTRY_COMMAND,
    opener: WUNDERKIND_TEAM_ENTRY_OPENER,
    teamName,
    status,
    teamModeEnabled,
    checkedConfigPaths,
    activeConfigPath: activeConfig?.path ?? null,
    activeConfigScope: activeConfig?.scope ?? null,
    activeConfigFormat: activeConfig?.format ?? null,
    projectTeamSpecPath,
    userTeamSpecPath,
    availableTeamSpecPath,
    availableTeamSpecScope,
  }
}
