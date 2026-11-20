import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { COLLECTIONS } from '@/services/repository';
import { exportCsv, exportPdf, exportXlsx, gradeRows, itemAnalysisRows, masteryRows, type ReportRow } from '@/services/reports';
import { buildStudentAnalysis } from '@/services/analytics/student';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Loading, PageHeader, Select } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import type { Exam, ExamResult, ItemAnalysis, LearningObjective, SchoolClass, Student, Subject } from '@/types';

type ReportType = 'nilai_siswa' | 'rekap_kelas' | 'ketuntasan' | 'tp' | 'kualitas_soal' | 'distribusi' | 'remedial' | 'riwayat';

const REPORT_LABELS: Record<ReportType, string> = {
  nilai_siswa: 'Hasil ujian per siswa', rekap_kelas: 'Rekap nilai per kelas', ketuntasan: 'Rekap ketuntasan',
  tp: 'Analisis per TP', kualitas_soal: 'Analisis kualitas soal', distribusi: 'Distribusi nilai',
  remedial: 'Daftar siswa perlu remedial', riwayat: 'Riwayat ujian'
};

export default function ReportsPage() {
  const exams = useCollection<Exam>(COLLECTIONS.exams);
  const results = useCollection<ExamResult>(COLLECTIONS.results);
  const students = useCollection<Student>(COLLECTIONS.students);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const subjects = useCollection<Subject>(COLLECTIONS.subjects);
  const analyses = useCollection<ItemAnalysis>(COLLECTIONS.itemAnalyses);
  const objectives = useCollection<LearningObjective>(COLLECTIONS.learningObjectives);
  const [type, setType] = useState<ReportType>('nilai_siswa');
  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredResults = useMemo(() => results.data.filter((result) => {
    const exam = exams.data.find((item) => item.id === result.examId);
    const date = new Date(result.gradedAt).getTime();
    return (!examId || result.examId === examId)
      && (!classId || result.classId === classId)
      && (!subjectId || result.subjectId === subjectId)
      && (!studentId || result.studentId === studentId)
      && (!fromDate || date >= new Date(fromDate).getTime())
      && (!toDate || date <= new Date(toDate + 'T23:59:59').getTime())
      && Boolean(exam);
  }), [results.data, exams.data, examId, classId, subjectId, studentId, fromDate, toDate]);

  const nameOf = (uid: string) => students.data.find((item) => item.uid === uid)?.name ?? uid;
  const examOf = (id: string) => exams.data.find((item) => item.id === id);
  const selectedExam = examOf(examId);

  const buildRows = async (): Promise<ReportRow[]> => {
    switch (type) {
      case 'nilai_siswa':
        return filteredResults.flatMap((result) => {
          const exam = examOf(result.examId);
          return exam ? gradeRows(exam, [result], students.data) : [];
        });
      case 'rekap_kelas': {
        const groups = new Map<string, number[]>();
        filteredResults.forEach((result) => groups.set(result.classId, [...(groups.get(result.classId) ?? []), result.finalScore]));
        return Array.from(groups.entries()).map(([id, scores]) => ({
          Kelas: classes.data.find((item) => item.id === id)?.name ?? id,
          Peserta: scores.length,
          'Rata-rata': Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
          Tertinggi: Math.max(...scores), Terendah: Math.min(...scores)
        }));
      }
      case 'ketuntasan': {
        const groups = new Map<string, { total: number; passed: number }>();
        filteredResults.forEach((result) => {
          const entry = groups.get(result.examId) ?? { total: 0, passed: 0 };
          entry.total += 1; if (result.passed) entry.passed += 1;
          groups.set(result.examId, entry);
        });
        return Array.from(groups.entries()).map(([id, entry]) => ({
          Ujian: examOf(id)?.name ?? id, Peserta: entry.total, Tuntas: entry.passed,
          'Persentase': Math.round((entry.passed / entry.total) * 1000) / 10
        }));
      }
      case 'tp': {
        const targets = studentId ? [studentId] : filteredResults.map((result) => result.studentId);
        const unique = Array.from(new Set(targets));
        const reports: ReportRow[] = [];
        for (const uid of unique) {
          const items = await buildStudentAnalysis(uid, { subjectId, threshold: 75, minItems: 3 });
          reports.push(...masteryRows(items, new Map(objectives.data.map((item) => [item.id, item.description])), nameOf(uid)));
        }
        return reports;
      }
      case 'kualitas_soal':
        return itemAnalysisRows(analyses.data.filter((item) => !examId || item.examId === examId));
      case 'distribusi': {
        const buckets = [
          { label: '0–39', min: 0, max: 39 }, { label: '40–59', min: 40, max: 59 },
          { label: '60–69', min: 60, max: 69 }, { label: '70–79', min: 70, max: 79 },
          { label: '80–89', min: 80, max: 89 }, { label: '90–100', min: 90, max: 100 }
        ];
        return buckets.map((bucket) => ({
          Rentang: bucket.label,
          Jumlah: filteredResults.filter((result) => result.finalScore >= bucket.min && result.finalScore <= bucket.max).length
        }));
      }
      case 'remedial': {
        const reports: ReportRow[] = [];
        for (const uid of Array.from(new Set(filteredResults.map((result) => result.studentId)))) {
          const items = await buildStudentAnalysis(uid, { subjectId, threshold: 75, minItems: 3 });
          reports.push(...masteryRows(items.filter((item) => item.status !== 'dikuasai'), new Map(objectives.data.map((item) => [item.id, item.code])), nameOf(uid)));
        }
        return reports;
      }
      case 'riwayat':
        return filteredResults.map((result) => ({
          Ujian: examOf(result.examId)?.name ?? result.examId,
          Siswa: nameOf(result.studentId),
          Nilai: result.finalScore,
          Status: result.status,
          Dinilai: formatDateTime(result.gradedAt),
          Dipublikasi: formatDateTime(result.publishedAt)
        }));
      default:
        return [];
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv' | 'pdf') => {
    setBusy(true);
    try {
      const rows = await buildRows();
      if (!rows.length) throw new Error('Tidak ada data pada filter yang dipilih.');
      const filename = `laporan-${type}-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'xlsx') await exportXlsx(filename, [{ name: 'Laporan', rows }]);
      else if (format === 'csv') await exportCsv(filename, rows);
      else await exportPdf(REPORT_LABELS[type], Object.keys(rows[0]), rows.map((row) => Object.values(row).map(String)), filename);
    } catch (caught) {
      // Notifikasi ditampilkan melalui alert ringan pada komponen induk bila diperlukan.
      console.error(caught);
    } finally { setBusy(false); }
  };

  if (exams.loading || results.loading || students.loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Laporan" description="Buat rekap hasil ujian, ketuntasan, kualitas soal, dan kebutuhan remedial." />
      <Card className="mb-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Jenis laporan" value={type} onChange={(event) => setType(event.target.value as ReportType)}>{Object.entries(REPORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <Select label="Ujian" value={examId} onChange={(event) => setExamId(event.target.value)}><option value="">Semua ujian</option>{exams.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select label="Kelas" value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Semua kelas</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select label="Mata pelajaran" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Semua mapel</option>{subjects.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select label="Siswa" value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Semua siswa</option>{students.data.map((item) => <option key={item.uid} value={item.uid}>{item.name}</option>)}</Select>
          <Input label="Dari tanggal" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input label="Sampai tanggal" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button onClick={() => void handleExport('xlsx')} loading={busy}><FileSpreadsheet className="h-4 w-4" /> Ekspor XLSX</Button>
          <Button variant="secondary" onClick={() => void handleExport('csv')} loading={busy}>Ekspor CSV</Button>
          <Button variant="secondary" onClick={() => void handleExport('pdf')} loading={busy}><FileText className="h-4 w-4" /> Ekspor PDF</Button>
          {selectedExam && <Badge tone="blue">{selectedExam.name}</Badge>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Pratinjau data" description={`${filteredResults.length} hasil sesuai filter`} />
        {filteredResults.length === 0 ? <EmptyState title="Tidak ada data" description="Ubah filter atau ekspor jenis laporan lain." /> : (
          <div className="overflow-x-auto p-4"><table className="table">
            <thead><tr><th>Siswa</th><th>Ujian</th><th>Nilai</th><th>Status</th><th>Waktu</th></tr></thead>
            <tbody>{filteredResults.slice(0, 25).map((result) => <tr key={result.id}>
              <td>{nameOf(result.studentId)}</td><td>{examOf(result.examId)?.name ?? result.examId}</td>
              <td className="font-semibold">{result.finalScore}</td><td><Badge tone={result.status === 'published' ? 'green' : 'amber'}>{result.status}</Badge></td>
              <td className="text-xs">{formatDateTime(result.gradedAt)}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </Card>
      <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Download className="h-4 w-4" /> File diekspor langsung di browser tanpa mengirim data ke layanan eksternal.</p>
    </div>
  );
}
