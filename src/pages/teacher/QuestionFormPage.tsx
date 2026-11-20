import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { db, isLocalMode } from '@/services/db';
import { COLLECTIONS, createEntity, updateEntity } from '@/services/repository';
import { mediaConfig, storeMedia } from '@/services/media';
import { MediaViewer } from '@/components/MediaViewer';
import { Badge, Button, Card, CardHeader, Checkbox, ErrorState, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { firstError, questionSchema } from '@/utils/validation';
import { questionCode } from '@/utils/id';
import type { Difficulty, GradingMethod, LearningObjective, MediaAsset, Question, QuestionBank, QuestionOption, QuestionType, Subject, AcademicYear, SchoolClass } from '@/types';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];
const emptyQuestion = (): Partial<Question> => ({
  code: '', prompt: '', stimulus: '', type: 'multiple_choice', options: [],
  correctAnswers: [], acceptedAnswers: [], explanation: '', difficulty: 'sedang',
  weight: 10, gradingMethod: 'exact_match', whitespaceTolerance: 'collapse_all',
  requiresManualReview: false, status: 'active', media: [], explanationMedia: [],
  learningObjectiveIds: [], material: '', tags: []
});

export default function QuestionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, notify } = useApp();
  const [form, setForm] = useState<Partial<Question>>(emptyQuestion());
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const explanationFileRef = useRef<HTMLInputElement>(null);

  const banks = useCollection<QuestionBank>(COLLECTIONS.questionBanks);
  const subjects = useCollection<Subject>(COLLECTIONS.subjects);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const years = useCollection<AcademicYear>(COLLECTIONS.academicYears);
  const objectives = useCollection<LearningObjective>(COLLECTIONS.learningObjectives);

  useEffect(() => {
    if (!id) return;
    db.get<Question>(COLLECTIONS.questions, id).then((found) => {
      if (found) setForm(found);
      else setError('Soal tidak ditemukan.');
      setLoading(false);
    }).catch((caught: Error) => { setError(caught.message); setLoading(false); });
  }, [id]);

  const set = <K extends keyof Question>(key: K, value: Question[K]) => setForm((current) => ({ ...current, [key]: value }));
  const visibleObjectives = objectives.data.filter((objective) => !form.subjectId || objective.subjectId === form.subjectId);

  const updateOptions = (options: QuestionOption[]) => {
    set('options', options);
    set('correctAnswers', options.filter((option) => option.isCorrect).map((option) => option.key));
  };

  const upload = async (files: FileList | null, target: 'question' | 'explanation') => {
    if (!files?.length) return;
    setUploadBusy(true);
    try {
      const assets: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        assets.push(await storeMedia(file, {
          actorId: user?.uid ?? 'system',
          externalUrl: mediaConfig.mode === 'external' ? uploadUrl : undefined
        }));
      }
      if (target === 'question') set('media', [...(form.media ?? []), ...assets]);
      else set('explanationMedia', [...(form.explanationMedia ?? []), ...assets]);
      notify(`${assets.length} media berhasil ditambahkan.`, 'success');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Gagal mengunggah media.', 'error');
    } finally {
      setUploadBusy(false);
      if (target === 'question' && fileRef.current) fileRef.current.value = '';
      if (target === 'explanation' && explanationFileRef.current) explanationFileRef.current.value = '';
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = questionSchema.safeParse({
      code: form.code, prompt: form.prompt, subjectId: form.subjectId, classId: form.classId,
      material: form.material, learningObjectiveIds: form.learningObjectiveIds,
      type: form.type, correctAnswers: form.type === 'completion' ? (form.acceptedAnswers?.length ? form.acceptedAnswers : form.correctAnswers) : form.correctAnswers,
      explanation: form.explanation, weight: form.weight, difficulty: form.difficulty
    });
    if (!parsed.success) { setError(firstError(parsed.error)); return; }
    if (form.type !== 'completion' && (form.options ?? []).length < 2) { setError('Minimal dua pilihan jawaban diperlukan.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code || questionCode(form.subjectId?.slice(0, 3).toUpperCase() ?? 'SOAL', (await db.list<Question>(COLLECTIONS.questions)).length + 1),
        teacherId: form.teacherId || profile?.uid || user?.uid || 'system',
        academicYearId: form.academicYearId || years.data.find((year) => year.active)?.id || '',
        semester: form.semester || years.data.find((year) => year.active)?.semester || 'ganjil',
        status: form.status ?? 'active'
      } as unknown as Record<string, unknown>;
      if (id) await updateEntity(COLLECTIONS.questions, id, payload, user?.uid ?? 'system');
      else await createEntity(COLLECTIONS.questions, payload, user?.uid ?? 'system', `${payload.code as string}_${Date.now()}`);
      notify(id ? 'Soal diperbarui.' : 'Soal disimpan ke bank soal.', 'success');
      navigate('/guru/bank-soal');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal menyimpan soal.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title={id ? 'Edit Soal' : 'Tambah Soal Baru'} description="Lengkapi seluruh informasi soal sebelum disimpan ke bank soal." actions={<Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Kembali</Button>} />
      {error && <ErrorState message={error} />}
      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardHeader title="Informasi dasar" />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Kode soal" value={form.code ?? ''} onChange={(event) => set('code', event.target.value)} placeholder="Otomatis bila kosong" />
            <Select label="Bank soal" value={form.bankId ?? ''} onChange={(event) => set('bankId', event.target.value)}>
              <option value="">— Pilih bank —</option>{banks.data.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
            </Select>
            <Select label="Mata pelajaran" value={form.subjectId ?? ''} onChange={(event) => set('subjectId', event.target.value)} required>
              <option value="">— Pilih mapel —</option>{subjects.data.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </Select>
            <Select label="Kelas" value={form.classId ?? ''} onChange={(event) => set('classId', event.target.value)} required>
              <option value="">— Pilih kelas —</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Select label="Tahun ajaran" value={form.academicYearId ?? ''} onChange={(event) => set('academicYearId', event.target.value)}>
              <option value="">— Pilih tahun —</option>{years.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Select label="Semester" value={form.semester ?? 'ganjil'} onChange={(event) => set('semester', event.target.value as 'ganjil' | 'genap')}>
              <option value="ganjil">Ganjil</option><option value="genap">Genap</option>
            </Select>
            <Input label="Materi" value={form.material ?? ''} onChange={(event) => set('material', event.target.value)} placeholder="Contoh: Lingkaran" required />
            <Select label="Tingkat kesulitan" value={form.difficulty ?? 'sedang'} onChange={(event) => set('difficulty', event.target.value as Difficulty)}>
              <option value="mudah">Mudah</option><option value="sedang">Sedang</option><option value="sukar">Sukar</option>
            </Select>
            <Input label="Bobot nilai" type="number" min={1} max={100} value={form.weight ?? 10} onChange={(event) => set('weight', Number(event.target.value))} required />
          </div>
          <div className="border-t border-slate-100 p-5">
            <p className="label">Tujuan Pembelajaran (boleh lebih dari satu)</p>
            <div className="grid gap-2 sm:grid-cols-2">{visibleObjectives.map((objective) => (
              <label key={objective.id} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent-500"
                  checked={(form.learningObjectiveIds ?? []).includes(objective.id)}
                  onChange={(event) => set('learningObjectiveIds', event.target.checked
                    ? [...(form.learningObjectiveIds ?? []), objective.id]
                    : (form.learningObjectiveIds ?? []).filter((value) => value !== objective.id))} />
                <span><span className="font-semibold">{objective.code}</span> — {objective.description}</span>
              </label>
            ))}{!visibleObjectives.length && <p className="text-sm text-slate-500">Belum ada TP. Tambahkan terlebih dahulu pada menu Tujuan Pembelajaran.</p>}</div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pertanyaan dan media" />
          <div className="space-y-4 p-5">
            <Select label="Jenis soal" value={form.type ?? 'multiple_choice'} onChange={(event) => set('type', event.target.value as QuestionType)}>
              <option value="multiple_choice">Pilihan ganda</option>
              <option value="multiple_response">Multiple response</option>
              <option value="completion">Completion (satu kata)</option>
            </Select>
            <Textarea label="Pertanyaan" value={form.prompt ?? ''} onChange={(event) => set('prompt', event.target.value)} rows={4} required />
            <Textarea label="Bahan stimulus (opsional)" value={form.stimulus ?? ''} onChange={(event) => set('stimulus', event.target.value)} rows={3} />
            {!isLocalMode && mediaConfig.mode === 'external' && <Input label="URL folder/media eksternal" value={uploadUrl} onChange={(event) => setUploadUrl(event.target.value)} placeholder="https://drive.google.com/…" hint="Media tidak disimpan di Firestore; gunakan Drive/CDN sekolah." />}
            <div>
              <input ref={fileRef} type="file" accept="image/*,audio/*,video/*" multiple className="hidden" onChange={(event) => void upload(event.target.files, 'question')} />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploadBusy}><ImagePlus className="h-4 w-4" /> Tambah gambar/audio/video</Button>
              <p className="mt-1 text-xs text-slate-500">Batas: gambar {(mediaConfig.maxImageBytes / 1048576).toFixed(1)} MB · audio {(mediaConfig.maxAudioBytes / 1048576).toFixed(1)} MB · video {(mediaConfig.maxVideoBytes / 1048576).toFixed(1)} MB / {mediaConfig.maxVideoSeconds} detik.</p>
              <div className="mt-3 flex flex-wrap gap-3">{(form.media ?? []).map((asset) => (
                <div key={asset.id} className="w-48 rounded-xl border border-slate-200 p-2">
                  <MediaViewer asset={asset} className="max-h-32 w-full" />
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs">{asset.name}</span><button type="button" className="text-rose-500" onClick={() => set('media', (form.media ?? []).filter((item) => item.id !== asset.id))}><Trash2 className="h-4 w-4" /></button></div>
                </div>
              ))}</div>
            </div>
          </div>
        </Card>

        {form.type !== 'completion' && (
          <Card>
            <CardHeader title="Pilihan jawaban" description="Centang satu atau beberapa jawaban benar." />
            <div className="space-y-3 p-5">
              {(form.options ?? []).map((option, index) => (
                <div key={option.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <label className="flex items-center gap-2 pt-2"><input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={option.isCorrect} onChange={(event) => updateOptions((form.options ?? []).map((item, position) => position === index ? { ...item, isCorrect: event.target.checked } : item))} /><span className="font-bold">{option.key}</span></label>
                  <div className="min-w-[12rem] flex-1"><Input value={option.text} onChange={(event) => updateOptions((form.options ?? []).map((item, position) => position === index ? { ...item, text: event.target.value } : item))} placeholder="Teks pilihan" /></div>
                  {option.image && <div className="w-28"><MediaViewer asset={option.image} className="max-h-20 w-full" /></div>}
                  <button type="button" className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => updateOptions((form.options ?? []).filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" disabled={(form.options ?? []).length >= 5} onClick={() => {
                const used = new Set((form.options ?? []).map((option) => option.key));
                const key = OPTION_KEYS.find((value) => !used.has(value));
                if (key) updateOptions([...(form.options ?? []), { id: `${Date.now()}_${key}`, key, text: '', isCorrect: false }]);
              }}><Plus className="h-4 w-4" /> Tambah opsi</Button>
              {form.type === 'multiple_response' && (
                <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <Select label="Metode penilaian" value={form.gradingMethod ?? 'exact_match'} onChange={(event) => set('gradingMethod', event.target.value as GradingMethod)}>
                    <option value="exact_match">Exact match (semua tepat)</option><option value="partial_credit">Partial credit</option>
                  </Select>
                  {form.gradingMethod === 'partial_credit' && <>
                    <Input label="Pengurangan per jawaban salah" type="number" step="0.1" min={0} value={form.partialCreditRule?.penaltyPerWrong ?? 0.5} onChange={(event) => set('partialCreditRule', { penaltyPerWrong: Number(event.target.value), minScore: form.partialCreditRule?.minScore ?? 0, allowNegative: form.partialCreditRule?.allowNegative ?? false })} />
                    <Input label="Nilai minimum (0–1)" type="number" step="0.1" min={0} max={1} value={form.partialCreditRule?.minScore ?? 0} onChange={(event) => set('partialCreditRule', { penaltyPerWrong: form.partialCreditRule?.penaltyPerWrong ?? 0.5, minScore: Number(event.target.value), allowNegative: form.partialCreditRule?.allowNegative ?? false })} />
                    <Checkbox label="Izinkan nilai negatif" checked={form.partialCreditRule?.allowNegative ?? false} onChange={(event) => set('partialCreditRule', { penaltyPerWrong: form.partialCreditRule?.penaltyPerWrong ?? 0.5, minScore: form.partialCreditRule?.minScore ?? 0, allowNegative: event.target.checked })} />
                  </>}
                </div>
              )}
            </div>
          </Card>
        )}

        {form.type === 'completion' && (
          <Card>
            <CardHeader title="Jawaban completion" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Input label="Jawaban yang diterima (pisahkan dengan koma)" value={(form.acceptedAnswers ?? []).join(', ')} onChange={(event) => set('acceptedAnswers', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="tali busur, tali" required />
              <Select label="Toleransi spasi" value={form.whitespaceTolerance ?? 'collapse_all'} onChange={(event) => set('whitespaceTolerance', event.target.value as NonNullable<Question['whitespaceTolerance']>)}>
                <option value="strict">Ketat (huruf kecil tetap dibedakan spasi)</option><option value="ignore_edges">Abaikan spasi tepi</option><option value="collapse_all">Abaikan semua spasi berlebih</option>
              </Select>
              <div className="sm:col-span-2"><Checkbox label="Perlu pemeriksaan guru (jawaban uraian/manual)" checked={form.requiresManualReview ?? false} onChange={(event) => set('requiresManualReview', event.target.checked)} /></div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Kunci dan pembahasan" description="Pembahasan baru dapat dilihat siswa setelah nilai dipublikasikan." />
          <div className="space-y-4 p-5">
            <Input label="Kunci jawaban (untuk pilihan ganda/response)" value={(form.correctAnswers ?? []).join(', ')} onChange={(event) => set('correctAnswers', event.target.value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))} hint="Contoh: A atau A, C untuk multiple response" />
            <Textarea label="Pembahasan / langkah penyelesaian" value={form.explanation ?? ''} onChange={(event) => set('explanation', event.target.value)} rows={4} required />
            <Input label="Tampilkan pembahasan setelah tanggal (opsional)" type="datetime-local" value={form.explanationAvailableAt ? form.explanationAvailableAt.slice(0, 16) : ''} onChange={(event) => set('explanationAvailableAt', event.target.value ? new Date(event.target.value).toISOString() : undefined)} />
            <div>
              <input ref={explanationFileRef} type="file" accept="image/*,audio/*,video/*" multiple className="hidden" onChange={(event) => void upload(event.target.files, 'explanation')} />
              <Button type="button" variant="secondary" size="sm" onClick={() => explanationFileRef.current?.click()}><ImagePlus className="h-4 w-4" /> Tambah media pendukung</Button>
              <div className="mt-3 flex flex-wrap gap-3">{(form.explanationMedia ?? []).map((asset) => <div key={asset.id} className="w-40 rounded-xl border border-slate-200 p-2"><MediaViewer asset={asset} className="max-h-24 w-full" /><button type="button" className="mt-1 text-xs text-rose-500" onClick={() => set('explanationMedia', (form.explanationMedia ?? []).filter((item) => item.id !== asset.id))}>Hapus</button></div>)}</div>
            </div>
            <Checkbox label="Soal aktif" checked={(form.status ?? 'active') === 'active'} onChange={(event) => set('status', event.target.checked ? 'active' : 'inactive')} />
          </div>
        </Card>

        <div className="sticky bottom-16 z-20 flex justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur md:bottom-4">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Batal</Button>
          <Button type="submit" loading={saving}>Simpan soal</Button>
        </div>
      </form>
      {profile?.role !== 'teacher' && profile?.role !== 'admin' && <Badge tone="red">Akses terbatas</Badge>}
    </div>
  );
}
