import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { COLLECTIONS, updateEntity } from '@/services/repository';
import { recomputeItemAnalysis } from '@/services/scoring/results';
import { DISCRIMINATION_LABEL } from '@/services/analytics';
import { Badge, Button, Card, CardHeader, EmptyState, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { formatNumber } from '@/utils/format';
import type { Exam, ItemAnalysis, LearningObjective, Question } from '@/types';

export default function ItemAnalysisPage() {
  const { user, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const examId = params.get('exam') ?? '';
  const exams = useCollection<Exam>(COLLECTIONS.exams);
  const analyses = useCollection<ItemAnalysis>(COLLECTIONS.itemAnalyses);
  const questions = useCollection<Question>(COLLECTIONS.questions);
  const objectives = useCollection<LearningObjective>(COLLECTIONS.learningObjectives);
  const [filterTp, setFilterTp] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const exam = exams.data.find((item) => item.id === examId);
  const rows = useMemo(() => analyses.data.filter((item) => item.examId === examId)
    .filter((item) => !filterCategory || item.discriminationCategory === filterCategory)
    .filter((item) => !filterTp || questions.data.find((question) => question.id === item.questionId)?.learningObjectiveIds.includes(filterTp))
    .sort((a, b) => a.questionId.localeCompare(b.questionId)), [analyses.data, examId, filterCategory, filterTp, questions.data]);

  const tpCode = (questionId: string) => questions.data.find((item) => item.id === questionId)?.learningObjectiveIds
    .map((id) => objectives.data.find((objective) => objective.id === id)?.code).filter(Boolean).join(', ') ?? '—';

  const recompute = async () => {
    if (!exam) return;
    setBusy(true);
    try {
      const count = await recomputeItemAnalysis(exam, user?.uid ?? 'system');
      notify(`Analisis ${count} butir diperbarui.`, 'success');
      await analyses.refresh();
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal menghitung analisis.', 'error'); }
    finally { setBusy(false); }
  };

  if (exams.loading || analyses.loading || questions.loading) return <Loading />;

  const chartData = rows.map((item) => ({
    name: questions.data.find((question) => question.id === item.questionId)?.code ?? item.questionId.slice(-5),
    kesukaran: item.difficultyIndex, dayaBeda: item.discriminationIndex
  }));
  const reliability = rows[0]?.reliability;

  return (
    <div>
      <PageHeader title="Analisis Butir Soal" description="Kesukaran, daya pembeda, validitas, reliabilitas, dan efektivitas pengecoh." actions={<Select value={examId} onChange={(event) => setParams({ exam: event.target.value })} className="w-64"><option value="">— Pilih ujian —</option>{exams.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>} />
      {!exam ? <Card><EmptyState title="Pilih ujian" description="Pilih ujian yang sudah dinilai untuk melihat analisis." /></Card> : <>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void recompute()} loading={busy}><RefreshCw className="h-4 w-4" /> Hitung ulang analisis</Button>
          <Select value={filterTp} onChange={(event) => setFilterTp(event.target.value)} className="w-56"><option value="">Semua TP</option>{objectives.data.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select>
          <Select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} className="w-56"><option value="">Semua daya beda</option>{Object.entries(DISCRIMINATION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </div>
        {reliability && <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase text-slate-500">Reliabilitas ({reliability.method})</p><p className="text-2xl font-bold">{formatNumber(reliability.value, 3)} <span className="text-sm font-normal text-slate-500">— {reliability.interpretation}</span></p></div>
            <div className="text-xs text-slate-500"><p>{reliability.itemCount} butir · {reliability.sampleSize} peserta</p>{reliability.warning && <p className="mt-1 text-amber-600">{reliability.warning}</p>}</div>
          </div>
        </Card>}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Kesukaran vs daya pembeda" />
            <div className="h-72 p-4">{chartData.length ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="kesukaran" fill="#2563eb" /><Bar dataKey="dayaBeda" fill="#10b981" /></BarChart>
            </ResponsiveContainer> : <EmptyState title="Belum ada analisis" />}</div>
          </Card>
          <Card>
            <CardHeader title="Catatan metodologi" />
            <ul className="list-inside list-disc space-y-2 p-5 text-sm leading-relaxed text-slate-600">
              <li>Kesukaran = proporsi siswa yang menjawab benar (0–1). Kategori: sukar ≤ 0,30; sedang 0,31–0,70; mudah &gt; 0,70.</li>
              <li>Daya pembeda = rata-rata kelompok atas 27% dikurangi kelompok bawah 27%, dibagi skor maksimum.</li>
              <li>Validitas butir memakai korelasi point-biserial. Korelasi butir–total bukan bukti validitas isi.</li>
              <li>KR-20 dipakai untuk skor dikotomis; Cronbach's Alpha untuk skor parsial. Koefisien tidak stabil bila sampel &lt; 20.</li>
              <li>Rekomendasi adalah saran; sistem tidak menghapus soal secara otomatis.</li>
            </ul>
          </Card>
        </div>
        <Card className="mt-4">
          <CardHeader title="Analisis per soal" description="Klik baris untuk melihat pengecoh dan catatan." />
          {rows.length === 0 ? <EmptyState title="Belum ada analisis" description="Nilai jawaban siswa terlebih dahulu, lalu klik Hitung ulang analisis." /> : (
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th>No</th><th>TP</th><th>Kesukaran</th><th>Daya Beda</th><th>Validitas</th><th>Rekomendasi</th><th>Status</th></tr></thead>
              <tbody>{rows.map((item, index) => <tr key={item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setExpanded(expanded === item.id ? null : item.id); setNoteDraft(item.notes.join('\n')); }}>
                <td>{index + 1}</td><td className="text-xs">{tpCode(item.questionId)}</td>
                <td>{formatNumber(item.difficultyIndex, 2)} <span className="text-xs text-slate-400">{item.difficultyCategory}</span></td>
                <td>{formatNumber(item.discriminationIndex, 2)} <span className="text-xs text-slate-400">{DISCRIMINATION_LABEL[item.discriminationCategory]}</span></td>
                <td>{formatNumber(item.pointBiserial, 2)} <Badge tone={item.validityStatus === 'valid' ? 'green' : item.validityStatus === 'ragu' ? 'amber' : 'red'}>{item.validityStatus}</Badge></td>
                <td><Badge tone={item.recommendation === 'dipertahankan' ? 'green' : item.recommendation === 'direvisi' ? 'amber' : 'red'}>{item.recommendation}</Badge></td>
                <td>{expanded === item.id ? '▾' : '▸'}</td>
              </tr>)}</tbody>
            </table></div>
          )}
          {expanded && (() => {
            const item = rows.find((row) => row.id === expanded);
            if (!item) return null;
            return <div className="border-t border-slate-100 bg-slate-50 p-5">
              <p className="font-semibold">Detail pengecoh</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{item.distractors.map((option) => <div key={option.key} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <p className="font-bold">Opsi {option.key}</p><p>Dipilih: {option.count} ({option.percentage}%)</p><p>Kelompok atas: {option.chosenByUpper}</p><p>Kelompok bawah: {option.chosenByLower}</p>
              </div>)}{!item.distractors.length && <p className="text-sm text-slate-500">Analisis pengecoh hanya untuk soal pilihan ganda/response.</p>}</div>
              <p className="mt-4 font-semibold">Catatan guru</p>
              <Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} />
              <Button size="sm" variant="secondary" className="mt-2" onClick={async () => {
                await updateEntity(COLLECTIONS.itemAnalyses, item.id, { notes: noteDraft.split('\n').filter(Boolean) }, user?.uid ?? 'system');
                notify('Catatan disimpan.', 'success'); await analyses.refresh();
              }}>Simpan catatan</Button>
            </div>;
          })()}
        </Card>
      </>}
    </div>
  );
}
