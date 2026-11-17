import type { ReactNode } from 'react'
import { Logo } from '@/ds'
import { href } from '@/site/href'
import { SUITE_URL } from '@/site/repo'
import { SEARCH_ID } from './search'

export interface NavItem {
  label: string
  order: number
  path: string
}

export interface ShellProps {
  path: string
  nav: NavItem[]
  suite: string
  children: ReactNode
}

function current(item: NavItem, path: string): boolean {
  return item.path === '/' ? path === '/' : path.startsWith(item.path)
}

// Rendered on the server around every page; it is never hydrated, so it holds no state.
export function Shell({ path, nav, suite, children }: ShellProps) {
  return (
    <>
      <a className="bc-skip" href="#content">
        Skip to content
      </a>
      <header className="bc-chrome">
        <a className="bc-chrome__id" href={href('/')}>
          <Logo lockup="mark" size={20} title="Springcraft" />
          <span>brep-conformance</span>
        </a>
        <form className="bc-search" role="search" action={href('/')} method="get">
          <input
            id={SEARCH_ID}
            name="q"
            type="search"
            className="sc-focus"
            placeholder="search tests, e.g. fillets or cylinders"
            aria-label="Search tests"
            autoComplete="off"
          />
        </form>
        <nav className="bc-chrome__nav" aria-label="site">
          {nav.map(item => (
            <a
              key={item.path}
              href={href(item.path)}
              aria-current={current(item, path) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
          <a href={SUITE_URL}>GitHub</a>
        </nav>
      </header>
      <main className="bc-main" id="content" tabIndex={-1}>
        {children}
      </main>
      <footer className="bc-foot">
        <span className="bc-annot">Maintained by Springcraft</span>
        <span className="bc-annot">
          suite {suite} · MIT · <a href={SUITE_URL}>source</a>
        </span>
      </footer>
    </>
  )
}
