import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dices, Save } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection, useDebounce } from '@/hooks/useCollection';
import { db } from '@/services/db';
import { createExamQuestionLink, createExamWithQuestions, getExamLinks, updateExamAssignments } from '@/services/exams';
import { COLLECTIONS, updateEntity } from '@/services/repository';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, ErrorState, Input, Loading, PageHeader, SearchInput, Select, Textarea } from '@/components/ui';
import { firstError, examSchema } from '@/utils/validation';
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '@/utils/format';
import type { AcademicYear, Exam, ExamAssignment, LearningObjective, Question, SchoolClass, Student, Subject } from '@/types';

interface SelectedQuestion { questionId: string; weight: number }

export default function ExamCreatePage() {
  const { user, notify } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const [editing, setEditing] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', subjectId: '', classId: '', academicYearId: '', semester: 'ganjil' as 'ganjil' | 'genap',
    startAt: toLocalInputValue(new Date(Date.now() + 3600_000).toISOString()),
    endAt: toLocalInputValue(new Date(Date.now() + 7 * 86400_000).toISOString()),
    durationMinutes: 30, maxAttempts: 1, passingScore: 70,
    randomizeQuestions: false, randomizeOptions: false, navigationMode: 'free' as 'free' | 'sequential',
    autosave: true, status: 'active' as Exam['status'], explanationMode: 'on_publish' as Exam['explanationMode'],
    explanationAvailableAt: ''
  });
  const [selected, setSelected] = useState<Map<string, SelectedQuestion>>(new Map());
  const [studentIds, setStudentIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ search: '', subjectId: '', classId: '', type: '', tpId: '', difficulty: '' });
  const debouncedSearch = useDebounce(filters.search);

  const questions = useCollection<Question>(COLLECTIONS.questions);
  const subjects = useCollection<Subject>(COLLECTIONS.subjects);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const years = useCollection<AcademicYear>(COLLECTIONS.academicYears);
  const students = useCollection<Student>(COLLECTIONS.students);
  const objectives = useCollection<LearningObjective>(COLLECTIONS.learningObjectives);

  useEffect(() => {
    if (!editId) return;
    Promise.all([
      db.get<Exam>(COLLECTIONS.exams, editId),
      getExamLinks(editId),
      db.list<ExamAssignment>(COLLECTIONS.assignments, { filters: [{ field: 'examId', op: '==', value: editId }] })
    ]).then(([exam, links, assignments]) => {
      if (!exam) { setError('Ujian tidak ditemukan.'); setLoading(false); return; }
      setEditing(exam);
      setForm({
        name: exam.name, description: exam.description, subjectId: exam.subjectId, classId: exam.classId,
        academicYearId: exam.academicYearId, semester: exam.semester,
        startAt: toLocalInputValue(exam.startAt), endAt: toLocalInputValue(exam.endAt),
        durationMinutes: exam.durationMinutes, maxAttempts: exam.maxAttempts, passingScore: exam.passingScore,
        randomizeQuestions: exam.randomizeQuestions, randomizeOptions: exam.randomizeOptions,
        navigationMode: exam.navigationMode, autosave: exam.autosave, status: exam.status,
        explanationMode: exam.explanationMode, explanationAvailableAt: exam.explanationAvailableAt ? toLocalInputValue(exam.explanationAvailableAt) : ''
      });
      setSelected(new Map(links.map((link) => [link.questionId, { questionId: link.questionId, weight: link.weight }])));
      setStudentIds(new Set(assignments.map((item) => item.studentId)));
      setLoading(false);
    }).catch((caught: Error) => { setError(caught.message); setLoading(false); });
  }, [editId]);

  const filteredQuestions = useMemo(() => questions.data.filter((question) => {
    const needle = debouncedSearch.toLocaleLowerCase('id-ID');
    return question.status === 'active'
      && (!needle || `${question.code} ${question.prompt} ${question.material}`.toLocaleLowerCase('id-ID').includes(needle))
      && (!filters.subjectId || question.subjectId === filters.subjectId)
      && (!filters.classId || question.classId === filters.classId)
      && (!filters.type || question.type === filters.type)
      && (!filters.difficulty || question.difficulty === filters.difficulty)
      && (!filters.tpId || question.learningObjectiveIds.includes(filters.tpId));
  }), [questions.data, debouncedSearch, filters]);

  const classStudents = students.data.filter((student) => !form.classId || student.classId === form.classId);
  const totalWeight = Array.from(selected.values()).reduce((sum, item) => sum + item.weight, 0);

  const toggleQuestion = (question: Question, checked: boolean) => setSelected((current) => {
    const next = new Map(current);
    if (checked) next.set(question.id, { questionId: question.id, weight: question.weight });
    else next.delete(question.id);
    return next;
  });

  const randomPick = () => {
    const pool = [...filteredQuestions].sort(() => Math.random() - 0.5).slice(0, Math.min(10, filteredQuestions.length));
    setSelected((current) => {
      const next = new Map(current);
      pool.forEach((question) => next.set(question.id, { questionId: question.id, weight: question.weight }));
      return next;
    });
    notify(`${pool.length} soal diambil secara acak.`, 'success');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = examSchema.safeParse({
      name: form.name, subjectId: form.subjectId, classId: form.classId,
      startAt: fromLocalInputValue(form.startAt), endAt: fromLocalInputValue(form.endAt),
      durationMinutes: form.durationMinutes, maxAttempts: form.maxAttempts, passingScore: form.passingScore
    });
    if (!parsed.success) { setError(firstError(parsed.error)); return; }
    if (!selected.size) { setError('Pilih minimal satu soal.'); return; }
    if (!studentIds.size) { setError('Pilih minimal satu peserta ujian.'); return; }
    setSaving(true);
    try {
      const base = {
        ...parsed.data,
        description: form.description, academicYearId: form.academicYearId || years.data[0]?.id || '', semester: form.semester,
        randomizeQuestions: form.randomizeQuestions, randomizeOptions: form.randomizeOptions,
        maxAttempts: form.maxAttempts, navigationMode: form.navigationMode, autosave: form.autosave,
        status: form.status, explanationMode: form.explanationMode,
        explanationAvailableAt: form.explanationAvailableAt ? fromLocalInputValue(form.explanationAvailableAt) : undefined,
        passingScore: form.passingScore, durationMinutes: form.durationMinutes,
        teacherId: editing?.teacherId ?? user?.uid ?? 'system'
      };
      if (editing) {
        const links = await getExamLinks(editing.id);
        await updateEntity(COLLECTIONS.exams, editing.id, {
          ...base, questionCount: selected.size, totalWeight,
          startAt: fromLocalInputValue(form.startAt), endAt: fromLocalInputValue(form.endAt)
        } as unknown as Record<string, unknown>, user?.uid ?? 'system');
        for (const link of links) {
          const mirrorId = `${editing.id}_${link.questionId}`;
          if (!selected.has(link.questionId)) {
            await db.remove(COLLECTIONS.examQuestions, link.id);
            await db.remove(COLLECTIONS.studentQuestions, mirrorId);
            await db.remove(COLLECTIONS.studentExplanations, mirrorId);
          } else {
            const weight = selected.get(link.questionId)?.weight ?? link.weight;
            await updateEntity(COLLECTIONS.examQuestions, link.id, { weight }, user?.uid ?? 'system');
            await db.update(COLLECTIONS.studentQuestions, mirrorId, { weight });
          }
        }
        for (const [questionId, item] of selected) {
          if (!links.some((link) => link.questionId === questionId)) {
            const question = await db.get<Question>(COLLECTIONS.questions, questionId);
            if (question) await createExamQuestionLink(editing.id, question, item.weight, selected.size, user?.uid ?? 'system');
          }
        }
        await updateExamAssignments(editing.id, Array.from(studentIds), form.classId, user?.uid ?? 'system');
      } else {
        await createExamWithQuestions(base as Omit<Exam, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
          Array.from(selected.values()), Array.from(studentIds), user?.uid ?? 'system');
      }
      notify(editing ? 'Ujian diperbarui.' : 'Ujian berhasil dibuat.', 'success');
      navigate('/guru/ujian');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal menyimpan ujian.');
    } finally { setSaving(false); }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title={editing ? 'Edit Ujian' : 'Buat Ujian Baru'} description="Atur jadwal, soal, dan peserta ujian." />
      {error && <ErrorState message={error} />}
      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardHeader title="Informasi ujian" />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2"><Input label="Nama ujian" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
            <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Exam['status'] })}>
              <option value="draft">Draft</option><option value="scheduled">Terjadwal</option><option value="active">Aktif</option><option value="closed">Ditutup</option>
            </Select>
            <div className="sm:col-span-3"><Textarea label="Deskripsi" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} /></div>
            <Select label="Mata pelajaran" value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} required><option value="">— Pilih —</option>{subjects.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <Select label="Kelas" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} required><option value="">— Pilih —</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <Select label="Tahun ajaran" value={form.academicYearId} onChange={(event) => setForm({ ...form, academicYearId: event.target.value })}><option value="">— Pilih —</option>{years.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <Input label="Waktu mulai" type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} required />
            <Input label="Waktu selesai" type="datetime-local" value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} required />
            <Input label="Durasi (menit)" type="number" min={1} max={600} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} required />
            <Input label="Batas percobaan" type="number" min={1} max={10} value={form.maxAttempts} onChange={(event) => setForm({ ...form, maxAttempts: Number(event.target.value) })} />
            <Input label="Nilai kelulusan" type="number" min={0} max={100} value={form.passingScore} onChange={(event) => setForm({ ...form, passingScore: Number(event.target.value) })} />
            <Select label="Navigasi soal" value={form.navigationMode} onChange={(event) => setForm({ ...form, navigationMode: event.target.value as 'free' | 'sequential' })}><option value="free">Bebas</option><option value="sequential">Berurutan</option></Select>
            <Select label="Pembukaan pembahasan" value={form.explanationMode} onChange={(event) => setForm({ ...form, explanationMode: event.target.value as Exam['explanationMode'] })}><option value="on_publish">Saat publikasi</option><option value="scheduled">Tanggal tertentu</option></Select>
            {form.explanationMode === 'scheduled' && <Input label="Tanggal pembukaan pembahasan" type="datetime-local" value={form.explanationAvailableAt} onChange={(event) => setForm({ ...form, explanationAvailableAt: event.target.value })} />}
          </div>
          <div className="flex flex-wrap gap-6 border-t border-slate-100 p-5">
            <Checkbox label="Acak urutan soal" checked={form.randomizeQuestions} onChange={(event) => setForm({ ...form, randomizeQuestions: event.target.checked })} />
            <Checkbox label="Acak pilihan jawaban" checked={form.randomizeOptions} onChange={(event) => setForm({ ...form, randomizeOptions: event.target.checked })} />
            <Checkbox label="Simpan jawaban otomatis" checked={form.autosave} onChange={(event) => setForm({ ...form, autosave: event.target.checked })} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Pilih soal" description={`${selected.size} soal dipilih · total bobot ${totalWeight}`} action={<Button type="button" variant="secondary" size="sm" onClick={randomPick}><Dices className="h-4 w-4" /> Ambil 10 soal acak</Button>} />
          <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <SearchInput value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} placeholder="Cari soal…" />
            <Select value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value })}><option value="">Semua mapel</option>{subjects.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <Select value={filters.classId} onChange={(event) => setFilters({ ...filters, classId: event.target.value })}><option value="">Semua kelas</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <Select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">Semua jenis</option><option value="multiple_choice">Pilihan ganda</option><option value="multiple_response">Multiple response</option><option value="completion">Completion</option></Select>
            <Select value={filters.tpId} onChange={(event) => setFilters({ ...filters, tpId: event.target.value })}><option value="">Semua TP</option>{objectives.data.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select>
          </div>
          {questions.loading ? <Loading /> : filteredQuestions.length === 0 ? <EmptyState title="Tidak ada soal" description="Buat soal terlebih dahulu di bank soal." /> : (
            <div className="max-h-96 overflow-auto"><table className="table">
              <thead><tr><th>Pilih</th><th>Kode</th><th>Pertanyaan</th><th>Jenis</th><th>Bobot</th></tr></thead>
              <tbody>{filteredQuestions.map((question) => (
                <tr key={question.id}>
                  <td><Checkbox label="" checked={selected.has(question.id)} onChange={(event) => toggleQuestion(question, event.target.checked)} /></td>
                  <td className="font-mono text-xs">{question.code}</td>
                  <td className="max-w-lg"><p className="line-clamp-2">{question.prompt}</p><p className="text-xs text-slate-400">{question.material}</p></td>
                  <td><Badge tone="violet">{question.type}</Badge></td>
                  <td><Input type="number" min={1} className="w-20" value={selected.get(question.id)?.weight ?? question.weight} onChange={(event) => setSelected((current) => {
                    const next = new Map(current);
                    if (next.has(question.id)) next.set(question.id, { questionId: question.id, weight: Number(event.target.value) });
                    return next;
                  })} disabled={!selected.has(question.id)} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>

        <Card>
          <CardHeader title="Peserta ujian" description="Siswa hanya dapat mengakses ujian yang secara eksplisit ditugaskan." action={<div className="flex gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => setStudentIds(new Set(classStudents.map((item) => item.uid)))}>Pilih semua kelas</Button><Button type="button" size="sm" variant="ghost" onClick={() => setStudentIds(new Set())}>Kosongkan</Button></div>} />
          {classStudents.length === 0 ? <EmptyState title="Belum ada siswa di kelas ini" description="Pilih kelas yang memiliki siswa." /> : (
            <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">{classStudents.map((student) => (
              <label key={student.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={studentIds.has(student.uid)} onChange={(event) => setStudentIds((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(student.uid); else next.delete(student.uid);
                  return next;
                })} />
                <span><span className="font-semibold">{student.name}</span><span className="block text-xs text-slate-500">{student.nis}</span></span>
              </label>
            ))}</div>
          )}
        </Card>

        <div className="sticky bottom-16 z-20 flex justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur md:bottom-4">
          <Button type="button" variant="secondary" onClick={() => navigate('/guru/ujian')}>Batal</Button>
          <Button type="submit" loading={saving}><Save className="h-4 w-4" /> {editing ? 'Simpan perubahan' : 'Buat ujian'}</Button>
        </div>
      </form>
      {editing && <p className="mt-3 text-xs text-slate-500">Ujian dibuat: {formatDateTime(editing.createdAt)}</p>}
    </div>
  );
}

