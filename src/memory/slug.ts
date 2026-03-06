import { readFileSync } from "node:fs"
import path from "node:path"

export function deriveProjectSlug(projectDir: string): string {
  let packageName: string | undefined
  try {
    const content = readFileSync(path.join(projectDir, "package.json"), "utf8")
    const pkg = JSON.parse(content)
    if (typeof pkg.name === "string") {
      packageName = pkg.name
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err
    }
  }

  if (packageName) {
    const sanitised = packageName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 63)

    if (sanitised.length > 0) {
      return sanitised
    }
  }

  const dirname = path.basename(projectDir)
  const sanitised = dirname
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63)

  if (sanitised.length > 0) {
    return sanitised
  }

  return "wunderkind-project"
}
