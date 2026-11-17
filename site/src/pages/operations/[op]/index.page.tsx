import { GradeMark, KernelChip, PageHead, Section, Table } from '@/components'
import type { KernelSupport } from '../catalog'
import { Markdown } from '../Markdown'
import '../operations.css'
import type { Props } from './index.data'

export default function OperationPage({ op, links }: Props) {
  const { doc } = op
  return (
    <>
      <PageHead
        title={op.id}
        corner={[doc.group, `offered by ${op.offeredBy.length} of ${op.kernels.length} kernels`]}
      />

      <Section label="definition" aside={`api.md § ${doc.heading}`}>
        <div className="bc-op-prose">
          <Markdown source={doc.body} links={links} />
        </div>
      </Section>

      {doc.groupIntro && (
        <Section label={`common to ${doc.group.toLowerCase()}`}>
          <div className="bc-op-prose bc-op-prose--quiet">
            <Markdown source={doc.groupIntro} links={links} />
          </div>
        </Section>
      )}

      <Section label="support" aside="as each kernel's adapter reports it">
        <div className="bc-op-scroll">
          <Table<KernelSupport>
            rowKey="kernel"
            sortBy={null}
            rows={op.kernels}
            columns={[
              { key: 'kernel', label: 'kernel', render: k => <KernelChip kernel={k.kernel} /> },
              {
                key: 'offered',
                label: 'offered',
                render: k =>
                  k.offered ? 'offered' : <GradeMark grade="unsupported" title="unsupported" />,
              },
              {
                key: 'standIn',
                label: 'sent instead',
                render: k => k.standIn ?? <span className="bc-op-dash">–</span>,
              },
            ]}
          />
        </div>
      </Section>
    </>
  )
}
