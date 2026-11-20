import type { Exam, ExamResult, ItemAnalysis, Student, StudentAnalysis } from '@/types';

export interface ReportRow {
  [key: string]: string | number | boolean | null | undefined;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9\-_]/gi, '_').slice(0, 80);
}

export async function exportXlsx(filename: string, sheets: Array<{ name: string; rows: ReportRow[] }>): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ Informasi: 'Tidak ada data' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), safeName(filename));
}

export async function exportCsv(filename: string, rows: ReportRow[]): Promise<void> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), safeName(filename));
}

export async function exportPdf(title: string, headers: string[], rows: Array<Array<string | number>>, filename: string): Promise<void> {
  const [{ jsPDF }, module] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = module.default;
  const document = new jsPDF({ orientation: rows[0] && rows[0].length > 6 ? 'landscape' : 'portrait' });
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text(title, 14, 18);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(`Dicetak: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`, 14, 25);
  autoTable(document, {
    head: [headers],
    body: rows.map((row) => row.map((cell) => String(cell ?? ''))),
    startY: 30,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 37, 71] }
  });
  document.save(safeName(filename));
}

export function gradeRows(exam: Exam, results: ExamResult[], students: Student[]): ReportRow[] {
  const names = new Map(students.map((student) => [student.uid, student.name]));
  return results.map((result) => ({
    Nama: names.get(result.studentId) ?? result.studentId,
    Ujian: exam.name,
    Nilai: result.finalScore,
    Status: result.status,
    Lulus: result.passed ? 'Ya' : 'Tidak',
    Dinilai: result.gradedAt,
    Dipublikasi: result.publishedAt ?? '-',
    Catatan: result.note ?? ''
  }));
}

export function itemAnalysisRows(analyses: ItemAnalysis[]): ReportRow[] {
  return analyses.map((analysis) => ({
    Butir: analysis.questionId,
    Sampel: analysis.sampleSize,
    Kesukaran: analysis.difficultyIndex,
    Kategori_Kesukaran: analysis.difficultyCategory,
    Daya_Beda: analysis.discriminationIndex,
    Kategori_Daya_Beda: analysis.discriminationCategory,
    Korelasi: analysis.pointBiserial,
    Validitas: analysis.validityStatus,
    Rekomendasi: analysis.recommendation,
    Catatan: analysis.notes.join(' | ')
  }));
}

export function masteryRows(analyses: StudentAnalysis[], objectiveMap: Map<string, string>, studentName: string): ReportRow[] {
  return analyses.map((analysis) => ({
    Siswa: studentName,
    TP: objectiveMap.get(analysis.learningObjectiveId) ?? analysis.learningObjectiveId,
    Jumlah_Soal: analysis.totalItems,
    Benar: analysis.correctItems,
    Persentase: analysis.percentage,
    Status: analysis.status,
    Bukti_Cukup: analysis.evidenceSufficient ? 'Ya' : 'Tidak'
  }));
}
