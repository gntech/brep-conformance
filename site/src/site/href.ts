// Every internal link goes through href, so the site works under a Pages project path (SITE_BASE).
export function href(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}

// Each param encoded as pathOf in routes.ts encodes it, so a link names the file prerender wrote.
const e = encodeURIComponent

export const url = {
  home: () => href('/'),
  report: (suite: string, kernel: string, version: string) =>
    href(`/reports/${e(suite)}/${e(kernel)}/${e(version)}/`),
  test: (operation: string, slug: string) => href(`/tests/${e(operation)}/${e(slug)}/`),
  operation: (operation: string) => href(`/operations/${e(operation)}/`),
  badge: (kernel: string) => href(`/badges/${e(kernel)}.svg`),
}
