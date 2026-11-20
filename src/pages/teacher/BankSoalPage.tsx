import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, Eye, FolderInput, Plus, Trash2, Upload } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection, useDebounce } from '@/hooks/useCollection';
import { db } from '@/services/db';
import { COLLECTIONS, createEntity, createPayload } from '@/services/repository';
import { parseJsonFile } from '@/services/questions/import';
import { MediaViewer } from '@/components/MediaViewer';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Loading, Modal, PageHeader, SearchInput, Select } from '@/components/ui';
import { formatNumber } from '@/utils/format';
import { nanoid } from '@/utils/id';
import type { AcademicYear, LearningObjective, Question, QuestionBank, SchoolClass, Subject } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Pilihan ganda', multiple_response: 'Multiple response', completion: 'Completion'
};

export default function BankSoalPage() {
  const { user, profile, notify } = useApp();
  const questions = useCollection<Question>(COLLECTIONS.questions);
  const banks = useCollection<QuestionBank>(COLLECTIONS.questionBanks);
  const subjects = useCollection<Subject>(COLLECTIONS.subjects);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const years = useCollection<AcademicYear>(COLLECTIONS.academicYears);
  const objectives = useCollection<LearningObjective>(COLLECTIONS.learningObjectives);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);
  const [filters, setFilters] = useState({ subjectId: '', classId: '', type: '', tpId: '', status: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Question | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question[] | null>(null);
  const [moveTarget, setMoveTarget] = useState<Question[] | null>(null);
  const [moveBankId, setMoveBankId] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameOf = (list: Array<{ id: string; name?: string }>, id: string) => list.find((item) => item.id === id)?.name ?? '—';
  const filtered = useMemo(() => questions.data.filter((question) => {
    const needle = debounced.toLocaleLowerCase('id-ID');
    const matchesQuery = !needle || `${question.code} ${question.prompt} ${question.material}`.toLocaleLowerCase('id-ID').includes(needle);
    return matchesQuery
      && (!filters.subjectId || question.subjectId === filters.subjectId)
      && (!filters.classId || question.classId === filters.classId)
      && (!filters.type || question.type === filters.type)
      && (!filters.tpId || question.learningObjectiveIds.includes(filters.tpId))
      && (!filters.status || question.status === filters.status)
      && question.status !== 'archived';
  }), [questions.data, debounced, filters]);

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const duplicate = async (question: Question) => {
    const copy = {
      ...question,
      id: nanoid(), code: `${question.code}-COPY-${Date.now().toString().slice(-4)}`,
      prompt: `${question.prompt}`,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: user?.uid ?? 'system', updatedBy: user?.uid ?? 'system'
    };
    await createEntity(COLLECTIONS.questions, copy as unknown as Record<string, unknown>, user?.uid ?? 'system', copy.id);
    notify('Soal berhasil diduplikasi.', 'success');
    await questions.refresh();
  };

  const archive = async (items: Question[]) => {
    setBusy(true);
    try {
      const allLinks = await db.list<{ questionId: string }>(COLLECTIONS.examQuestions);
      const usedIds = new Set(allLinks.map((link) => link.questionId));
      for (const item of items) {
        if (usedIds.has(item.id)) {
          await db.update(COLLECTIONS.questions, item.id, { status: 'archived', updatedBy: user?.uid ?? 'system', updatedAt: new Date().toISOString() });
        } else {
          await db.remove(COLLECTIONS.questions, item.id);
        }
      }
      notify(`${items.length} soal diproses. Soal yang sudah dipakai ujian diarsipkan.`, 'success');
      setSelected(new Set());
      setDeleteTarget(null);
      await questions.refresh();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Gagal menghapus soal.', 'error');
    } finally { setBusy(false); }
  };

  const move = async () => {
    if (!moveTarget || !moveBankId) return;
    setBusy(true);
    try {
      for (const question of moveTarget) await db.update(COLLECTIONS.questions, question.id, { bankId: moveBankId, updatedBy: user?.uid ?? 'system', updatedAt: new Date().toISOString() });
      notify(`${moveTarget.length} soal dipindahkan.`, 'success');
      setMoveTarget(null);
      await questions.refresh();
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal memindahkan soal.', 'error'); }
    finally { setBusy(false); }
  };

  const exportBank = (items: Question[]) => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), questions: items.map((question) => ({
      ...question, bankName: nameOf(banks.data, question.bankId)
    })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `bank-soal-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    URL.revokeObjectURL(url);
    notify(`${items.length} soal diekspor.`, 'success');
  };

  const importBank = async (file: File | undefined) => {
    if (!file) return;
    try {
      const report = await parseJsonFile(file);
      if (!report.questions.length) throw new Error('Tidak ada soal dalam file.');
      setBusy(true);
      const actorId = user?.uid ?? 'system';
      const operations = report.questions.map((draft, index) => {
        const question = {
          id: nanoid(), code: draft.prompt ? `IMP-${Date.now().toString().slice(-5)}-${index + 1}` : `IMP-${index + 1}`,
          prompt: draft.prompt, type: draft.type,
          options: draft.options.map((option) => ({ id: nanoid(), key: option.key, text: option.text, isCorrect: draft.answerKeys.includes(option.key) })),
          correctAnswers: draft.answerKeys, acceptedAnswers: draft.type === 'completion' ? draft.answerKeys : [],
          explanation: draft.explanation || '(belum diisi)',
          subjectId: filters.subjectId || subjects.data[0]?.id || '',
          classId: filters.classId || classes.data[0]?.id || '',
          academicYearId: years.data[0]?.id || '', semester: 'ganjil',
          bankId: banks.data[0]?.id || '', material: 'Hasil impor',
          learningObjectiveIds: [], difficulty: 'sedang', weight: 10,
          gradingMethod: 'exact_match', whitespaceTolerance: 'collapse_all',
          requiresManualReview: false, status: 'active', teacherId: profile?.uid ?? actorId, tags: ['impor']
        };
        return { type: 'create' as const, collection: COLLECTIONS.questions, id: question.id, data: createPayload(question as unknown as Record<string, unknown>, actorId) };
      });
      await db.batch(operations);
      notify(`${operations.length} soal diimpor. Periksa kembali kunci dan TP sebelum dipakai.`, 'success');
      await questions.refresh();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Gagal mengimpor bank soal.', 'error');
    } finally { setBusy(false); }
  };

  if (questions.error) return <ErrorState message={questions.error} onRetry={() => void questions.refresh()} />;

  return (
    <div>
      <PageHeader title="Bank Soal" description="Kelola, filter, dan gunakan kembali soal untuk berbagai ujian." actions={<>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importBank(event.target.files?.[0])} />
        <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={busy}><Upload className="h-4 w-4" /> Impor JSON</Button>
        <Button variant="secondary" onClick={() => exportBank(selected.size ? filtered.filter((item) => selected.has(item.id)) : filtered)}><Download className="h-4 w-4" /> Ekspor</Button>
        <Link to="/guru/soal/baru" className="btn-primary"><Plus className="h-4 w-4" /> Tambah soal</Link>
      </>} />
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2"><SearchInput value={query} onChange={setQuery} placeholder="Cari kode, teks, atau materi…" /></div>
          <Select value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value })}><option value="">Semua mapel</option>{subjects.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select value={filters.classId} onChange={(event) => setFilters({ ...filters, classId: event.target.value })}><option value="">Semua kelas</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">Semua jenis</option><option value="multiple_choice">Pilihan ganda</option><option value="multiple_response">Multiple response</option><option value="completion">Completion</option></Select>
          <Select value={filters.tpId} onChange={(event) => setFilters({ ...filters, tpId: event.target.value })}><option value="">Semua TP</option>{objectives.data.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select>
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-sm">
            <span className="font-semibold text-accent-700">{selected.size} soal dipilih</span>
            <Button size="sm" variant="secondary" onClick={() => setMoveTarget(filtered.filter((item) => selected.has(item.id)))}><FolderInput className="h-4 w-4" /> Pindahkan</Button>
            <Button size="sm" variant="danger" onClick={() => setDeleteTarget(filtered.filter((item) => selected.has(item.id)))}><Trash2 className="h-4 w-4" /> Hapus massal</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan</Button>
          </div>
        )}
        {questions.loading ? <Loading /> : filtered.length === 0 ? <EmptyState title="Tidak ada soal" description="Ubah filter atau tambahkan soal baru." /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr>
              <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={(event) => setSelected(event.target.checked ? new Set(filtered.map((item) => item.id)) : new Set())} /></th>
              <th>Kode</th><th>Pertanyaan</th><th>Jenis</th><th>Materi / TP</th><th>Bobot</th><th>Status</th><th>Aksi</th>
            </tr></thead>
            <tbody>{filtered.slice(0, 50).map((question) => (
              <tr key={question.id}>
                <td><input type="checkbox" checked={selected.has(question.id)} onChange={() => toggle(question.id)} /></td>
                <td className="whitespace-nowrap font-mono text-xs">{question.code}</td>
                <td className="max-w-md"><p className="line-clamp-2">{question.prompt}</p>{question.media?.length ? <Badge tone="blue">{question.media.length} media</Badge> : null}</td>
                <td><Badge tone="violet">{TYPE_LABEL[question.type]}</Badge></td>
                <td><p className="text-xs">{question.material}</p><p className="text-xs text-slate-400">{question.learningObjectiveIds.map((id) => objectives.data.find((item) => item.id === id)?.code).filter(Boolean).join(', ') || '—'}</p></td>
                <td>{formatNumber(question.weight, 0)}</td>
                <td><Badge tone={question.status === 'active' ? 'green' : 'amber'}>{question.status}</Badge></td>
                <td><div className="flex gap-1">
                  <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Preview" onClick={() => setPreview(question)}><Eye className="h-4 w-4" /></button>
                  <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Duplikasi" onClick={() => void duplicate(question)}><Copy className="h-4 w-4" /></button>
                  <Link className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" to={`/guru/soal/${question.id}`} title="Edit">✎</Link>
                  <button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Hapus" onClick={() => setDeleteTarget([question])}><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {filtered.length > 50 && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Menampilkan 50 dari {filtered.length} soal. Gunakan filter untuk mempersempit hasil.</p>}
      </Card>

      <Modal open={Boolean(preview)} title={`Preview soal ${preview?.code ?? ''}`} onClose={() => setPreview(null)}>
        {preview && <div className="space-y-3">
          <div className="flex gap-2"><Badge tone="blue">{TYPE_LABEL[preview.type]}</Badge><Badge tone="slate">{preview.difficulty}</Badge><Badge tone="slate">Bobot {preview.weight}</Badge></div>
          <p className="whitespace-pre-wrap font-medium">{preview.prompt}</p>
          {preview.media?.map((asset) => <MediaViewer key={asset.id} asset={asset} />)}
          <ol className="space-y-1">{preview.options.map((option) => <li key={option.id} className={`rounded-lg border p-2 ${option.isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}><strong>{option.key}.</strong> {option.text}{option.image ? <MediaViewer asset={option.image} className="mt-2 max-h-32" /> : null}</li>)}</ol>
          {preview.type === 'completion' && <p>Jawaban diterima: {preview.acceptedAnswers.join(', ')}</p>}
          <div className="rounded-xl bg-slate-50 p-3"><p className="label">Pembahasan</p><p className="whitespace-pre-wrap text-sm">{preview.explanation}</p></div>
        </div>}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Konfirmasi penghapusan" message={`Hapus ${deleteTarget?.length ?? 0} soal? Soal yang sudah digunakan dalam ujian akan diarsipkan, bukan dihapus, agar histori tetap utuh.`} onClose={() => setDeleteTarget(null)} onConfirm={() => archive(deleteTarget ?? [])} loading={busy} />

      <Modal open={Boolean(moveTarget)} title="Pindahkan soal ke bank lain" onClose={() => setMoveTarget(null)} width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{moveTarget?.length ?? 0} soal akan dipindahkan.</p>
          <Select label="Bank soal tujuan" value={moveBankId} onChange={(event) => setMoveBankId(event.target.value)}>
            <option value="">— Pilih bank —</option>{banks.data.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
          </Select>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setMoveTarget(null)}>Batal</Button><Button onClick={() => void move()} loading={busy} disabled={!moveBankId}>Pindahkan</Button></div>
        </div>
      </Modal>
    </div>
  );
}
