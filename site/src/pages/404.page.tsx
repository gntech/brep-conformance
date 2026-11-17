import { EmptyState } from '@/ds'
import { href } from '@/site/href'

export const title = 'not found'

export default function NotFound() {
  return (
    <>
      <h1 className="bc-sr">Page not found</h1>
      <EmptyState
        code="404"
        title="no page here"
        height={320}
        action={<a href={href('/')}>results</a>}
      />
    </>
  )
}
