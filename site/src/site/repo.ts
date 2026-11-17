// The suite's source.
export const REPO = 'https://github.com/springcraft-ai/brep-conformance'
export const SUITE_URL = REPO

export function sourceUrl(path: string): string {
  return `${REPO}/blob/main/${path.replace(/^\//, '')}`
}
