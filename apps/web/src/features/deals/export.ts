// Exporting rows of the exchange sheet, as an Excel sheet or a PDF. The
// libraries load only when someone exports, so the Book stays light.

export interface ExportTable {
  /** "Exchange book · Sarrif – Eastleigh · 2026-10-09". */
  title: string;
  /** Without an extension. */
  fileName: string;
  headers: string[];
  /** Cell text, in the headers' order, and the row's highlight colour if any. */
  rows: { cells: string[]; highlight: string | null }[];
  /** "Charges: +160.00 USD + 299.00 KES", under the table. */
  footer: string;
}

export async function exportExcel(table: ExportTable): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = table.headers.map((value) => ({ value, fontWeight: 'bold' as const }));
  const body = table.rows.map((row) => row.cells.map((value) => ({ value, ...(row.highlight ? { backgroundColor: row.highlight } : {}) })));
  const footer = [{ value: table.footer, fontWeight: 'bold' as const }];
  await writeXlsxFile([[{ value: table.title, fontWeight: 'bold' as const }], [], header, ...body, [], footer], {
    columns: table.headers.map(() => ({ width: 18 })),
  }).toFile(`${table.fileName}.xlsx`);
}

export async function exportPdf(table: ExportTable): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(table.title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [table.headers],
    body: table.rows.map((row) => row.cells),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 20, 20] },
    // Highlighted rows keep their colour on paper.
    didParseCell: (data) => {
      const colour = data.section === 'body' ? table.rows[data.row.index]?.highlight : null;
      if (colour) data.cell.styles.fillColor = colour;
    },
  });
  const end = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 22;
  doc.setFontSize(10);
  doc.text(table.footer, 14, end + 8);
  doc.save(`${table.fileName}.pdf`);
}
