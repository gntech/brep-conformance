import type { AriaAttributes } from 'react'
import { DataTable, type DataColumn, type DataTableProps } from '@/ds'

export type { DataColumn as Column }

// The system's DataTable: micro-caps header, machine-face values, hairline rows, sortable. Its
// sorting and row selection work only on a page that hydrates.
export function Table<R>(props: DataTableProps<R> & AriaAttributes) {
  return <DataTable<R> density="compact" {...props} />
}
