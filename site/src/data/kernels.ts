// What the site states about each kernel beyond its report: its license and where its source is.
// A report carries neither, so a kernel joining the leaderboard adds a line here. Pure: a hydrated
// page may import it.

export interface KernelInfo {
  // An SPDX expression where the kernel has one.
  license: string
  source: string | null
  // Set where the suite's maintainer makes the kernel, which a ranking must say.
  maintainers?: true
}

const KERNELS: Record<string, KernelInfo> = {
  arris: { license: 'MIT OR Apache-2.0', source: 'https://github.com/arris-labs/arris' },
  opencascade: {
    license: 'LGPL-2.1-only WITH OCCT-exception-1.0',
    source: 'https://github.com/Open-Cascade-SAS/OCCT',
  },
  solidcore: { license: 'Apache-2.0', source: 'https://github.com/tangency-labs/solidcore' },
  springrep: { license: 'proprietary', source: null, maintainers: true },
}

export function kernelInfo(kernel: string): KernelInfo | null {
  return KERNELS[kernel] ?? null
}
