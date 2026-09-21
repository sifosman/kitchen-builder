// Minimal node typings for tests — the repo has no @types/node.
declare module 'node:fs' {
  export function existsSync(p: string): boolean
  const fs: { existsSync(p: string): boolean }
  export default fs
}
declare module 'node:path' {
  export function join(...parts: string[]): string
  const path: { join(...parts: string[]): string }
  export default path
}
declare const process: { cwd(): string }
