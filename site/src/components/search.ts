import { useEffect, useRef } from 'react'

// The chrome's search box. Without JS it submits to the results page as ?q=; a hydrated page that
// can search in place takes it over and filters as the reader types.
export const SEARCH_ID = 'bc-search'

export function useChromeSearch(q: string, onChange: (q: string) => void) {
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    const input = document.getElementById(SEARCH_ID) as HTMLInputElement | null
    if (!input) return
    const onInput = () => latest.current(input.value)
    const onSubmit = (e: Event) => e.preventDefault()
    input.addEventListener('input', onInput)
    input.form?.addEventListener('submit', onSubmit)
    return () => {
      input.removeEventListener('input', onInput)
      input.form?.removeEventListener('submit', onSubmit)
    }
  }, [])

  useEffect(() => {
    const input = document.getElementById(SEARCH_ID) as HTMLInputElement | null
    if (input && input.value !== q) input.value = q
  }, [q])
}

export function queryFromUrl(): string {
  return new URLSearchParams(window.location.search).get('q') ?? ''
}
