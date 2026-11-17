// A kernel's name, and its version when one is given. Every kernel gets the same chip: no colour,
// no mark, nothing that sets one apart.
export function KernelChip({
  kernel,
  version,
  href,
}: {
  kernel: string
  version?: string
  href?: string
}) {
  const body = (
    <>
      <span>{kernel}</span>
      {version && <span className="bc-chip__version">{version}</span>}
    </>
  )
  return href ? (
    <a className="bc-chip" href={href}>
      {body}
    </a>
  ) : (
    <span className="bc-chip">{body}</span>
  )
}
