import { useEffect, useState } from 'react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { buildStudentAnalysis } from '@/services/analytics/student';
import { COLLECTIONS } from '@/services/repository';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Loading, PageHeader, Select } from '@/components/ui';
import { formatDate } from '@/utils/format';
import { exportCsv, exportXlsx, masteryRows } from '@/services/reports';
import type { LearningObjective, SchoolClass, Student, StudentAnalysis, Subject } from '@/types';

export default function StudentAnalysisPage() {
  const { notify } = useApp();
  const students = useCollection<Student>(COLLECTIONS.students);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const subjects = useCollection<Subject>(COLLECTIONS.subjects);
  const objectives = useCollection<LearningObjective>(COLLECTIONS.learningObjectives);
  const [studentId, setStudentId] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [minItems, setMinItems] = useState(3);
  const [data, setData] = useState<StudentAnalysis[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId) { setData([]); return; }
    setLoading(true);
    buildStudentAnalysis(studentId, { subjectId, threshold, minItems })
      .then(setData)
      .catch((caught: Error) => notify(caught.message, 'error'))
      .finally(() => setLoading(false));
  }, [studentId, subjectId, threshold, minItems, notify]);

  const student = students.data.find((item) => item.uid === studentId);
  const objectiveMap = new Map(objectives.data.map((item) => [item.id, `${item.code} — ${item.description}`]));
  const mastered = data.filter((item) => item.status === 'dikuasai');
  const needs = data.filter((item) => item.status !== 'dikuasai');
  const trend = data.flatMap((item) => item.trend.map((entry) => ({ tanggal: formatDate(entry.date), nilai: entry.percentage }))).slice(-12);

  return (
    <div>
      <PageHeader title="Analisis Siswa" description="Lihat kelemahan penguasaan materi per Tujuan Pembelajaran dan rekomendasi remedial." actions={<Button variant="secondary" disabled={!data.length} onClick={() => void exportXlsx(`analisis-siswa-${student?.name ?? 'siswa'}.xlsx`, [{ name: 'Analisis TP', rows: masteryRows(data, objectiveMap, student?.name ?? studentId) }])}>Ekspor XLSX</Button>} />
      <Card className="mb-5 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Kelas" value={classFilter} onChange={(event) => {
            const classId = event.target.value;
            setClassFilter(classId);
            setStudentId(students.data.find((item) => item.classId === classId)?.uid ?? '');
          }}><option value="">— Pilih kelas —</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select label="Siswa" value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">— Pilih siswa —</option>{students.data.filter((item) => !classFilter || item.classId === classFilter).map((item) => <option key={item.uid} value={item.uid}>{item.name} ({item.nis})</option>)}</Select>
          <Select label="Mata pelajaran" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Semua mapel</option>{subjects.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Input label="Ambang ketercapaian (%)" type="number" min={0} max={100} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
          <Input label="Minimum soal per TP" type="number" min={1} max={20} value={minItems} onChange={(event) => setMinItems(Number(event.target.value))} />
        </div>
      </Card>
      {!studentId ? <Card><EmptyState title="Pilih siswa" description="Analisis akan dihitung dari hasil ujian yang sudah dipublikasikan." /></Card> : loading ? <Loading /> : data.length === 0 ? <Card><EmptyState title="Belum ada bukti" description="Siswa belum memiliki hasil ujian terpublikasi untuk mata pelajaran ini." /></Card> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">TP dikuasai</p><p className="mt-1 text-2xl font-bold text-emerald-600">{mastered.length}</p></Card>
            <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Perlu penguatan/remedial</p><p className="mt-1 text-2xl font-bold text-amber-600">{needs.length}</p></Card>
          </div>
          <Card>
            <CardHeader title={`Penguasaan TP — ${student?.name ?? ''}`} description={`Ambang ketercapaian ${threshold}% · minimal ${minItems} soal per TP`} />
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th>TP</th><th className="text-right">Jumlah soal</th><th className="text-right">Benar</th><th className="text-right">Persentase</th><th>Status</th></tr></thead>
              <tbody>{data.map((item) => <tr key={item.id}>
                <td><p className="text-sm font-medium">{objectiveMap.get(item.learningObjectiveId) ?? item.learningObjectiveId}</p>{!item.evidenceSufficient && <p className="text-xs text-amber-600">Bukti belum cukup ({item.totalItems} soal)</p>}</td>
                <td className="text-right">{item.totalItems}</td><td className="text-right">{item.correctItems}</td><td className="text-right">{item.percentage}%</td>
                <td><Badge tone={item.status === 'dikuasai' ? 'green' : item.status === 'perlu_penguatan' ? 'amber' : 'red'}>{item.status.replaceAll('_', ' ')}</Badge></td>
              </tr>)}</tbody>
            </table></div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Riwayat perkembangan" />
              <div className="h-64 p-4">{trend.length ? <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="tanggal" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="nilai" stroke="#2563eb" strokeWidth={2} /></LineChart>
              </ResponsiveContainer> : <EmptyState title="Belum ada riwayat" />}</div>
            </Card>
            <Card>
              <CardHeader title="Rekomendasi remedial" />
              <div className="space-y-2 p-5 text-sm">{needs.length ? needs.map((item) => (
                <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-900">{objectiveMap.get(item.learningObjectiveId)}</p>
                  <p className="text-amber-800">Capai {item.percentage}% dari {item.totalItems} soal. {item.evidenceSufficient ? 'Perlu latihan tambahan dan pendampingan.' : 'Tambahkan soal untuk mendapatkan bukti yang cukup sebelum menyimpulkan kelemahan.'}</p>
                </div>
              )) : <p className="text-emerald-700">Seluruh TP dengan bukti cukup sudah dikuasai.</p>}</div>
            </Card>
          </div>
          <Card className="p-4"><Button variant="secondary" disabled={!data.length} onClick={() => void exportCsv(`remedial-${student?.name ?? 'siswa'}.csv`, masteryRows(data, objectiveMap, student?.name ?? studentId))}>Ekspor daftar remedial (CSV)</Button></Card>
        </div>
      )}
    </div>
  );
}
