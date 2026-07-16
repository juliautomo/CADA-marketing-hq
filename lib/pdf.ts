import PDFDocument from 'pdfkit'

// ── Colours ────────────────────────────────────────────────────────────────────
const VIOLET  = '#7C3AED'
const ZINC900 = '#18181B'
const ZINC600 = '#52525B'
const ZINC400 = '#A1A1AA'
const WHITE   = '#FFFFFF'
const EMERALD = '#10B981'

interface CampaignBriefData {
  name: string
  startDate: string
  endDate: string
  channels: string[]
  summary?: string
  objective?: string
  kpis?: string[]
  weeks?: Array<{
    week: number
    theme: string
    milestones: Array<{ title: string; day_offset: number; description?: string }>
  }>
}

export function generateCampaignBriefPDF(data: CampaignBriefData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width - 100  // usable width
    const L = 50                     // left margin

    // ── COVER HEADER ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 140).fill(VIOLET)

    doc.fillColor(WHITE)
       .fontSize(26).font('Helvetica-Bold')
       .text('Marketing HQ', L, 35, { width: W })

    doc.fontSize(13).font('Helvetica')
       .text('Campaign Brief', L, 68)

    doc.fontSize(9).fillColor('rgba(255,255,255,0.7)')
       .text(`Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, L, 90)

    doc.moveDown(0)
    doc.y = 160

    // ── META ROW ──────────────────────────────────────────────────────────────
    doc.fillColor(ZINC900).fontSize(18).font('Helvetica-Bold')
       .text(data.name, L, doc.y)

    doc.fontSize(10).font('Helvetica').fillColor(ZINC600)
       .text(`${data.startDate}  →  ${data.endDate}   ·   ${data.channels.join(', ')}`, L, doc.y + 4)

    doc.moveDown(1.5)
    divider(doc, L, W)

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    if (data.summary) {
      sectionTitle(doc, L, '01 — Summary')
      doc.fontSize(10).font('Helvetica').fillColor(ZINC600)
         .text(data.summary, L, doc.y, { width: W, align: 'justify' })
      doc.moveDown(1.2)
    }

    // ── OBJECTIVE ─────────────────────────────────────────────────────────────
    if (data.objective) {
      sectionTitle(doc, L, '02 — Objective')
      doc.fillColor(ZINC900).fontSize(10).font('Helvetica')
         .text(data.objective, L, doc.y, { width: W })
      doc.moveDown(1.2)
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────
    if (data.kpis && data.kpis.length > 0) {
      sectionTitle(doc, L, '03 — Key Performance Indicators')
      data.kpis.forEach((kpi, i) => {
        // dot + text
        doc.fillColor(EMERALD).circle(L + 5, doc.y + 6, 3).fill()
        doc.fillColor(ZINC900).fontSize(10).font('Helvetica')
           .text(`${i + 1}.  ${kpi}`, L + 16, doc.y, { width: W - 16 })
        doc.moveDown(0.4)
      })
      doc.moveDown(0.8)
    }

    // ── 4-WEEK PLAN ───────────────────────────────────────────────────────────
    if (data.weeks && data.weeks.length > 0) {
      sectionTitle(doc, L, '04 — 4-Week Campaign Plan')

      data.weeks.forEach((week) => {
        // Check if we need a new page
        if (doc.y > 680) doc.addPage()

        // Week header bar
        doc.rect(L, doc.y, W, 24).fill(ZINC900)
        doc.fillColor(WHITE).fontSize(10).font('Helvetica-Bold')
           .text(`WEEK ${week.week}  —  ${week.theme.toUpperCase()}`, L + 10, doc.y + 7)
        doc.moveDown(0)
        doc.y += 30

        // Milestones
        week.milestones?.forEach((m) => {
          if (doc.y > 720) doc.addPage()

          doc.fillColor(VIOLET).fontSize(9).font('Helvetica-Bold')
             .text(`▸  ${m.title}`, L + 8, doc.y, { width: W - 8 })
          doc.moveDown(0.2)

          if (m.description) {
            doc.fillColor(ZINC600).fontSize(8.5).font('Helvetica')
               .text(m.description, L + 20, doc.y, { width: W - 20 })
            doc.moveDown(0.3)
          }
          doc.moveDown(0.3)
        })

        doc.moveDown(0.5)
      })
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.fillColor(ZINC400).fontSize(8).font('Helvetica')
         .text(
           `Marketing HQ  ·  Confidential  ·  Page ${i + 1} of ${pages.count}`,
           L, doc.page.height - 35,
           { width: W, align: 'center' }
         )
    }

    doc.end()
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sectionTitle(doc: InstanceType<typeof PDFDocument>, x: number, text: string) {
  doc.rect(x, doc.y, 3, 16).fill(VIOLET)
  doc.fillColor(ZINC900).fontSize(12).font('Helvetica-Bold')
     .text(text, x + 10, doc.y, { lineBreak: false })
  doc.moveDown(0.8)
}

function divider(doc: InstanceType<typeof PDFDocument>, x: number, w: number) {
  doc.rect(x, doc.y, w, 0.5).fill('#E4E4E7')
  doc.moveDown(1)
}
