export type PdfEntreprise = {
  nom: string
  adresse?: string | null
  telephone?: string | null
  email?: string | null
  rccm?: string | null
  nif?: string | null
}

export type PdfLigne = {
  designation: string
  unite?: string | null
  quantite: number
  prix_unit: number
  total: number
}

export type PdfOptions = {
  type: 'facture' | 'devis' | 'relance'
  entreprise: PdfEntreprise
  numero: string
  date_emission?: string | null
  date_echeance?: string | null
  date_validite?: string | null
  client_nom?: string | null
  tva_taux?: number | null
  ht: number
  tva: number
  ttc: number
  montant_paye?: number | null
  notes?: string | null
  lignes: PdfLigne[]
  relance_message?: string
}

export async function generateDocument(opts: PdfOptions): Promise<void> {
  const [{ default: jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 20
  const CW = W - 2 * M

  type RGB = [number, number, number]
  const BLACK:  RGB = [28,  28,  28]
  const DARK:   RGB = [70,  70,  70]
  const MID:    RGB = [130, 130, 130]
  const LGRAY:  RGB = [200, 200, 200]
  const VLGRAY: RGB = [245, 245, 245]
  const ALTROW: RGB = [251, 251, 251]
  const ORANGE: RGB = [168, 62,  8]

  const st = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const sd = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const sf = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const fmtD = (d?: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : ''
  const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const { entreprise: ent } = opts

  let y = M

  /* ══════════════════════════════════════════════════════
     EN-TÊTE
  ══════════════════════════════════════════════════════ */

  // Colonne gauche — entreprise
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  st(BLACK)
  doc.text(ent.nom, M, y)

  let leftBottom = y + 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  st(DARK)

  if (ent.adresse)   { doc.text(ent.adresse,              M, leftBottom); leftBottom += 5 }
  if (ent.telephone) { doc.text(`Tél : ${ent.telephone}`, M, leftBottom); leftBottom += 5 }
  if (ent.email)     { doc.text(ent.email,                M, leftBottom); leftBottom += 5 }
  if (ent.rccm)      { doc.text(`RCCM : ${ent.rccm}`,    M, leftBottom); leftBottom += 5 }
  if (ent.nif)       { doc.text(`NIF : ${ent.nif}`,       M, leftBottom); leftBottom += 5 }

  // Colonne droite — titre + méta
  const titleLabel =
    opts.type === 'facture' ? 'FACTURE' :
    opts.type === 'devis'   ? 'DEVIS'   : 'RELANCE'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  st(BLACK)
  doc.text(titleLabel, W - M, M, { align: 'right', charSpace: 1.5 })

  let rightY = M + 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  st(DARK)

  doc.text(`Numéro : ${opts.numero}`, W - M, rightY, { align: 'right' })
  rightY += 5.5

  if (opts.date_emission) {
    doc.text(`Date d'émission : ${fmtD(opts.date_emission)}`, W - M, rightY, { align: 'right' })
    rightY += 5.5
  }
  if (opts.date_echeance) {
    doc.text(`Date d'échéance : ${fmtD(opts.date_echeance)}`, W - M, rightY, { align: 'right' })
    rightY += 5.5
  }
  if (opts.date_validite) {
    doc.text(`Validité de l'offre : ${fmtD(opts.date_validite)}`, W - M, rightY, { align: 'right' })
    rightY += 5.5
  }

  y = Math.max(leftBottom, rightY) + 6

  // Séparateur
  sd(LGRAY)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 9

  /* ══════════════════════════════════════════════════════
     BLOC DESTINATAIRE
  ══════════════════════════════════════════════════════ */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  st(MID)
  doc.text("Facture a l'attention de", M, y)
  y += 5.5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  st(BLACK)
  doc.text(opts.client_nom ?? '—', M, y)
  y += 10

  /* ══════════════════════════════════════════════════════
     TABLEAU DES LIGNES
  ══════════════════════════════════════════════════════ */
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 32 },
    showHead: 'everyPage',
    theme: 'grid',
    head: [['Désignation', 'Unité', 'Qté', 'Prix unit. FCFA', 'Montant FCFA']],
    body: opts.lignes.length > 0
      ? opts.lignes.map(l => [
          l.designation,
          l.unite ?? '',
          fmtN(l.quantite),
          fmtN(l.prix_unit),
          fmtN(l.total),
        ])
      : [['Aucune ligne', '', '', '', '']],
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: BLACK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: [220, 220, 220] as RGB,
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: VLGRAY,
      textColor: DARK,
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: LGRAY,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: ALTROW,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 22,     halign: 'left' },
      2: { cellWidth: 16,     halign: 'right' },
      3: { cellWidth: 42,     halign: 'right' },
      4: { cellWidth: 42,     halign: 'right' },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 8

  /* ══════════════════════════════════════════════════════
     TOTAUX (alignés à droite)
  ══════════════════════════════════════════════════════ */
  const totW = 90
  const totX = W - M - totW
  const RH   = 7.5

  const totRows: Array<{ label: string; value: string; bold?: boolean; large?: boolean } | null> = [
    { label: 'Sous-total HT',                  value: `${fmtN(opts.ht)} FCFA` },
    { label: `TVA (${opts.tva_taux ?? 18} %)`, value: `${fmtN(opts.tva)} FCFA` },
    null,
    { label: 'Total TTC', value: `${fmtN(opts.ttc)} FCFA`, bold: true, large: true },
  ]

  for (const row of totRows) {
    if (!row) {
      sd(LGRAY); doc.setLineWidth(0.3); doc.line(totX, y, W - M, y); y += 4
      continue
    }
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal')
    doc.setFontSize(row.large ? 13 : 10)
    st(row.large ? ORANGE : DARK)
    doc.text(row.label, totX, y + 5.5)
    st(row.large ? ORANGE : BLACK)
    doc.text(row.value, W - M, y + 5.5, { align: 'right' })
    y += RH
  }
  y += 5

  /* ══════════════════════════════════════════════════════
     STATUT PAIEMENT (facture seulement)
  ══════════════════════════════════════════════════════ */
  const paye = opts.montant_paye ?? 0
  if (paye > 0 && opts.type === 'facture') {
    const restant = Math.max(0, opts.ttc - paye)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); st(MID)
    doc.text(`Montant payé : ${fmtN(paye)} FCFA`, W - M, y, { align: 'right' })
    y += 5.5
    doc.setFont('helvetica', 'bold'); st(DARK)
    doc.text(`Reste à payer : ${fmtN(restant)} FCFA`, W - M, y, { align: 'right' })
    y += 8
  }

  /* ══════════════════════════════════════════════════════
     MESSAGE RELANCE (relance seulement)
  ══════════════════════════════════════════════════════ */
  if (opts.type === 'relance' && opts.relance_message) {
    y += 2
    const msgClean = opts.relance_message
      .replace(/\*/g, '')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); st(DARK)
    for (const para of msgClean.split('\n')) {
      if (y > 250) break
      if (!para.trim()) { y += 3; continue }
      for (const line of doc.splitTextToSize(para, CW) as string[]) {
        if (y > 250) break
        doc.text(line, M, y); y += 5
      }
    }
    y += 4
  }

  /* ══════════════════════════════════════════════════════
     CONDITIONS DE PAIEMENT
  ══════════════════════════════════════════════════════ */
  const condY = Math.min(y + 4, 258)
  sd(LGRAY); doc.setLineWidth(0.2); doc.line(M, condY, W - M, condY)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); st(MID)
  doc.text('Paiement à réception par Orange Money, Wave ou virement bancaire.', M, condY + 6)
  doc.text(
    "Tout retard de paiement pourra faire l'objet de pénalités conformément aux conditions générales.",
    M, condY + 11
  )

  /* ══════════════════════════════════════════════════════
     PIED DE PAGE — toutes les pages
  ══════════════════════════════════════════════════════ */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (doc as any).getNumberOfPages() as number
  const footParts = [ent.nom, ent.telephone, ent.email].filter(Boolean) as string[]

  for (let p = 1; p <= totalPages; p++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(doc as any).setPage(p)
    sd(LGRAY); doc.setLineWidth(0.3); doc.line(M, 281, W - M, 281)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); st(MID)
    doc.text(footParts.join('  ·  '), M, 287)
    doc.text(`Page ${p} / ${totalPages}`, W - M, 287, { align: 'right' })
  }

  /* ══════════════════════════════════════════════════════
     ENREGISTREMENT
  ══════════════════════════════════════════════════════ */
  const prefix =
    opts.type === 'facture' ? 'Facture' :
    opts.type === 'devis'   ? 'Devis'   : 'Relance'
  doc.save(`${prefix}_${opts.numero}_${new Date().toISOString().split('T')[0]}.pdf`)
}
