declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void
    toContain(expected: unknown): void
    toMatch(expected: RegExp | string): void
    toBeGreaterThan(expected: number): void
    toBeDefined(): void
    toBeUndefined(): void
    toEqual(expected: unknown): void
    toHaveProperty(path: string, value?: unknown): void
    toHaveLength(length: number): void
    not: Matchers
  }

  export const describe: (name: string, fn: () => void) => void
  export const it: (name: string, fn: () => void | Promise<void>) => void
  export const expect: (value: unknown) => Matchers
  export const beforeEach: (fn: () => void | Promise<void>) => void
  export const mock: {
    <T extends (...args: never[]) => unknown>(fn?: T): T & {
      mockClear(): void
      mockImplementation(impl: T): void
      calls: unknown[][]
    }
    module(modulePath: string, factory: () => Record<string, unknown>): void
  }
}
