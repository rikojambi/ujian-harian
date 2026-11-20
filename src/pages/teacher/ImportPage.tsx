import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { db } from '@/services/db';
import { parseImportFile } from '@/services/questions/import';
import { COLLECTIONS, createEntity } from '@/services/repository';
import { nanoid } from '@/utils/id';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import type { AcademicYear, ImportDraftQuestion, ImportReport, LearningObjective, Question, QuestionBank, SchoolClass, Subject } from '@/types';

export default function ImportPage() {
  const { user, profile, notify } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ImportDraftQuestion | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [bankId, setBankId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil');

  const subjects = useCollection<Subject>(COLLECTIONS.subjects);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const banks = useCollection<QuestionBank>(COLLECTIONS.questionBanks);
  const years = useCollection<AcademicYear>(COLLECTIONS.academicYears);
  const objectives = useCollection<LearningObjective>(COLLECTIONS.learningObjectives);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseImportFile(file);
      setReport(parsed);
      notify(`${parsed.questions.length} soal terbaca dari ${file.name}.`, 'success');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Gagal membaca dokumen.', 'error');
    } finally { setBusy(false); }
  };

  const updateDraft = (next: ImportDraftQuestion) => {
    if (!report) return;
    setReport({ ...report, questions: report.questions.map((item) => item.tempId === next.tempId ? next : item) });
    setEditing(null);
  };

  const saveAll = async () => {
    if (!report || !subjectId || !classId) { notify('Pilih mata pelajaran dan kelas terlebih dahulu.', 'error'); return; }
    setBusy(true);
    try {
      const actorId = user?.uid ?? 'system';
      let sequence = (await db.list<Question>(COLLECTIONS.questions)).length;
      for (const draft of report.questions) {
        sequence += 1;
        const tp = objectives.data.find((objective) => objective.code === draft.learningObjectiveCode
          || objective.description.toLocaleLowerCase('id-ID').includes((draft.learningObjectiveCode ?? '').toLocaleLowerCase('id-ID')));
        const question = {
          id: nanoid(), code: `IMP-${String(sequence).padStart(4, '0')}`,
          bankId, subjectId, classId, academicYearId: yearId, semester,
          material: tp?.material || 'Hasil impor',
          learningObjectiveIds: tp ? [tp.id] : [],
          type: draft.type, prompt: draft.prompt,
          options: draft.options.map((option) => ({ id: nanoid(), key: option.key, text: option.text, isCorrect: draft.answerKeys.includes(option.key) })),
          correctAnswers: draft.answerKeys,
          acceptedAnswers: draft.type === 'completion' ? draft.answerKeys : [],
          explanation: draft.explanation || '(pembahasan belum diisi)',
          difficulty: 'sedang', weight: 10, gradingMethod: 'exact_match',
          whitespaceTolerance: 'collapse_all', requiresManualReview: false,
          status: 'active', teacherId: profile?.uid ?? actorId, tags: ['impor', report.format]
        } as unknown as Question;
        await createEntity(COLLECTIONS.questions, question as unknown as Record<string, unknown>, actorId, question.id);
      }
      notify(`${report.questions.length} soal hasil impor disimpan ke bank soal.`, 'success');
      setReport(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Gagal menyimpan soal impor.', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Impor Soal" description="Impor soal dari dokumen DOCX, RTF, atau JSON. Hasil ekstraksi selalu ditinjau sebelum disimpan." />
      <Card className="p-5">
        <input ref={fileRef} type="file" accept=".docx,.rtf,.json" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-accent-400 hover:bg-blue-50/40">
          <FileUp className="h-10 w-10 text-accent-500" />
          <span className="font-semibold text-navy-900">Pilih dokumen soal</span>
          <span className="text-sm text-slate-500">DOCX, RTF, atau JSON · nomor soal dan opsi A–E dikenali otomatis</span>
        </button>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Keterbatasan: parser DOCX memakai Mammoth (gambar hanya teridentifikasi, tidak diunggah otomatis). Parser RTF hanya mengekstrak teks dan Unicode; tabel, rumus, dan gambar RTF tidak dapat diproses. Selalu periksa hasil preview.
        </p>
      </Card>

      {report && (
        <div className="mt-5 space-y-5">
          <Card>
            <CardHeader title="Pengaturan penyimpanan" description="Soal hasil impor akan disimpan ke bank soal yang dipilih." />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Select label="Mata pelajaran" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">— Pilih —</option>{subjects.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
              <Select label="Kelas" value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">— Pilih —</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
              <Select label="Bank soal" value={bankId} onChange={(event) => setBankId(event.target.value)}><option value="">— Pilih —</option>{banks.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
              <Select label="Tahun ajaran" value={yearId} onChange={(event) => setYearId(event.target.value)}><option value="">— Pilih —</option>{years.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
              <Select label="Semester" value={semester} onChange={(event) => setSemester(event.target.value as 'ganjil' | 'genap')}><option value="ganjil">Ganjil</option><option value="genap">Genap</option></Select>
            </div>
          </Card>

          {(report.warnings.length > 0 || report.unprocessedMedia.length > 0) && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> Perhatian</p>
              <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
                {report.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                {report.unprocessedMedia.length > 0 && <li>Media tidak diproses otomatis: {report.unprocessedMedia.join(', ')}. Tambahkan manual pada editor soal.</li>}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title={`Preview ekstraksi (${report.questions.length} soal)`} description="Klik edit untuk memperbaiki teks, kunci, TP, atau jenis soal." action={<Button onClick={() => void saveAll()} loading={busy} disabled={!subjectId || !classId}><CheckCircle2 className="h-4 w-4" /> Simpan semua soal</Button>} />
            {report.questions.length === 0 ? <EmptyState title="Tidak ada soal terbaca" description="Periksa kembali format dokumen Anda." /> : (
              <div className="space-y-3 p-4">
                {report.questions.map((draft) => (
                  <div key={draft.tempId} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2"><Badge tone="blue">No. {draft.number}</Badge><Badge tone="violet">{draft.type}</Badge>{draft.learningObjectiveCode && <Badge tone="slate">{draft.learningObjectiveCode}</Badge>}</div>
                        <p className="mt-2 text-sm font-medium">{draft.prompt}</p>
                        <p className="mt-1 text-xs text-slate-500">Opsi: {draft.options.map((option) => `${option.key}. ${option.text}`).join(' | ') || '—'}</p>
                        <p className="mt-1 text-xs text-emerald-700">Kunci: {draft.answerKeys.join(', ') || 'belum ada'}</p>
                        <p className="mt-1 text-xs text-slate-500">Pembahasan: {draft.explanation || 'belum ada'}</p>
                        {draft.warnings.map((warning, index) => <p key={index} className="mt-1 text-xs text-amber-600">⚠ {warning}</p>)}
                      </div>
                      <div className="flex gap-1">
                        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setEditing(draft)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => setReport({ ...report, questions: report.questions.filter((item) => item.tempId !== draft.tempId) })} aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal open={Boolean(editing)} title={`Edit soal nomor ${editing?.number ?? ''}`} onClose={() => setEditing(null)}>
        {editing && <DraftEditor draft={editing} objectives={objectives.data} onSave={updateDraft} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function DraftEditor({ draft, objectives, onSave, onCancel }: {
  draft: ImportDraftQuestion; objectives: LearningObjective[];
  onSave: (draft: ImportDraftQuestion) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState(draft);
  return (
    <div className="space-y-4">
      <Select label="Jenis soal" value={value.type} onChange={(event) => setValue({ ...value, type: event.target.value as ImportDraftQuestion['type'] })}>
        <option value="multiple_choice">Pilihan ganda</option><option value="multiple_response">Multiple response</option><option value="completion">Completion</option>
      </Select>
      <Textarea label="Pertanyaan" value={value.prompt} onChange={(event) => setValue({ ...value, prompt: event.target.value })} rows={3} />
      <Input label="Opsi (format: A=teks; B=teks)" value={value.options.map((option) => `${option.key}=${option.text}`).join('; ')} onChange={(event) => setValue({ ...value, options: event.target.value.split(';').map((part) => {
        const [key, ...rest] = part.split('=');
        return { key: key.trim().toUpperCase(), text: rest.join('=').trim() };
      }).filter((option) => option.key) })} />
      <Input label="Kunci jawaban (pisahkan koma)" value={value.answerKeys.join(', ')} onChange={(event) => setValue({ ...value, answerKeys: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
      <Textarea label="Pembahasan" value={value.explanation} onChange={(event) => setValue({ ...value, explanation: event.target.value })} rows={3} />
      <Select label="Tujuan Pembelajaran" value={value.learningObjectiveCode ?? ''} onChange={(event) => setValue({ ...value, learningObjectiveCode: event.target.value })}>
        <option value="">— Belum dipetakan —</option>{objectives.map((objective) => <option key={objective.id} value={objective.code}>{objective.code} — {objective.description}</option>)}
      </Select>
      <Checkbox label="Tandai perlu pemeriksaan guru" checked={value.warnings.includes('perlu pemeriksaan')} onChange={(event) => setValue({ ...value, warnings: event.target.checked ? [...value.warnings, 'perlu pemeriksaan'] : value.warnings.filter((item) => item !== 'perlu pemeriksaan') })} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={onCancel}>Batal</Button><Button onClick={() => onSave(value)}>Simpan perubahan</Button></div>
    </div>
  );
}
