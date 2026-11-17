import type { Report } from '@/data/results'
import type { OperationDoc } from './spec'

// Whether each kernel offers a function, from its report's `unsupported` list, and the function
// the suite sends instead of a constructor a kernel lacks. The flat report does not say which tests
// call a function, so a function's pass rate and doc/process.md's interoperable status, which rest
// on its tests, are not shown.
export interface KernelSupport {
  kernel: string
  offered: boolean
  standIn: string | null
}

export interface Operation {
  id: string
  doc: OperationDoc
  kernels: KernelSupport[]
  offeredBy: string[]
}

export function catalog(docs: OperationDoc[], latest: Report[]): Operation[] {
  return docs.map(doc => {
    const kernels = latest.map(r => ({
      kernel: r.identity.kernel,
      offered: !r.unsupported.includes(doc.id),
      standIn: r.standIns[doc.id] ?? null,
    }))
    return {
      id: doc.id,
      doc,
      kernels,
      offeredBy: kernels.filter(k => k.offered).map(k => k.kernel),
    }
  })
}
