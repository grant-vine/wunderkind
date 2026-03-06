declare module "bun:sqlite" {
  type SqliteValue = string | number | bigint | boolean | null
  type SqliteParams = Record<string, SqliteValue>

  export interface RunResult {
    changes: number
    lastInsertRowid: number
  }

  export class Statement<T = unknown, Params = SqliteParams> {
    all(params?: Params): T[]
    get(params?: Params): T | undefined
    run(params?: Params): RunResult
  }

  export class Database {
    constructor(path?: string, options?: { create?: boolean })
    exec(sql: string): void
    prepare<T = unknown, Params = SqliteParams>(sql: string): Statement<T, Params>
    query(sql: string): Statement
    transaction<T>(fn: (params: T) => void): (params: T) => void
  }
}
