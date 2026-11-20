import { Link } from 'react-router-dom';
import { Copy, Eye, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { db } from '@/services/db';
import { COLLECTIONS, createEntity } from '@/services/repository';
import { gradeAttempt, recomputeItemAnalysis } from '@/services/scoring/results';
import { buildStudentQuestionDoc } from '@/services/exams';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Loading, PageHeader, SearchInput } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import { nanoid } from '@/utils/id';
import { useDebounce } from '@/hooks/useCollection';
import { useState } from 'react';
import type { Exam, ExamAssignment, ExamAttempt, ExamQuestionLink, ExamResult, Question } from '@/types';

export default function ExamsPage() {
  const { user, notify } = useApp();
  const exams = useCollection<Exam>(COLLECTIONS.exams);
  const assignments = useCollection<ExamAssignment>(COLLECTIONS.assignments);
  const attempts = useCollection<ExamAttempt>(COLLECTIONS.attempts);
  const results = useCollection<ExamResult>(COLLECTIONS.results);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);
  const [deleting, setDeleting] = useState<Exam | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = exams.data.filter((exam) => exam.name.toLocaleLowerCase('id-ID').includes(debounced.toLocaleLowerCase('id-ID')));

  const duplicate = async (exam: Exam) => {
    setBusy(true);
    try {
      const links = await db.list<ExamQuestionLink>(COLLECTIONS.examQuestions, { filters: [{ field: 'examId', op: '==', value: exam.id }] });
      const newId = nanoid();
      const actorId = user?.uid ?? 'system';
      await createEntity(COLLECTIONS.exams, {
        ...exam, id: newId, name: `${exam.name} (salinan)`, status: 'draft',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: actorId, updatedBy: actorId
      } as unknown as Record<string, unknown>, actorId, newId);
      const operations = [];
      for (const [order, link] of links.entries()) {
        const data = { ...link, id: `${newId}_${link.questionId}`, examId: newId, order, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        operations.push({ type: 'create' as const, collection: COLLECTIONS.examQuestions, id: data.id, data: data as unknown as Record<string, unknown> });
        const question = await db.get<Question>(COLLECTIONS.questions, link.questionId);
        if (question) {
          const { studentQuestion, explanation } = buildStudentQuestionDoc(newId, question, order, link.weight, actorId);
          operations.push(
            { type: 'create' as const, collection: COLLECTIONS.studentQuestions, id: studentQuestion.id, data: studentQuestion as unknown as Record<string, unknown> },
            { type: 'create' as const, collection: COLLECTIONS.studentExplanations, id: explanation.id, data: explanation as unknown as Record<string, unknown> }
          );
        }
      }
      await db.batch(operations);
      notify('Ujian berhasil diduplikasi sebagai draft.', 'success');
      await exams.refresh();
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal menduplikasi.', 'error'); }
    finally { setBusy(false); }
  };

  const removeExam = async () => {
    if (!deleting) return;
    if (attempts.data.some((attempt) => attempt.examId === deleting.id)) {
      notify('Ujian yang sudah memiliki percobaan tidak dapat dihapus. Gunakan status arsip.', 'error');
      setDeleting(null);
      return;
    }
    setBusy(true);
    try {
      for (const collection of [COLLECTIONS.examQuestions, COLLECTIONS.studentQuestions, COLLECTIONS.studentExplanations, COLLECTIONS.assignments]) {
        const items = await db.list<{ id: string }>(collection, { filters: [{ field: 'examId', op: '==', value: deleting.id }] });
        for (const item of items) await db.remove(collection, item.id);
      }
      await db.remove(COLLECTIONS.exams, deleting.id);
      notify('Ujian dihapus.', 'success');
      setDeleting(null);
      await exams.refresh();
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal menghapus.', 'error'); }
    finally { setBusy(false); }
  };

  const gradeAll = async (exam: Exam) => {
    setBusy(true);
    try {
      const submitted = attempts.data.filter((attempt) => attempt.examId === exam.id && attempt.status === 'submitted');
      for (const attempt of submitted) await gradeAttempt(exam, attempt.id, user?.uid ?? 'system');
      if (submitted.length) await recomputeItemAnalysis(exam, user?.uid ?? 'system');
      notify(`${submitted.length} jawaban dinilai otomatis.`, 'success');
      await Promise.all([attempts.refresh(), results.refresh()]);
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal menilai.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Daftar Ujian" description="Kelola jadwal, peserta, dan status ujian." actions={<Link to="/guru/buat-ujian" className="btn-primary">Buat ujian</Link>} />
      <Card>
        <div className="border-b border-slate-100 p-4"><SearchInput value={query} onChange={setQuery} placeholder="Cari ujian…" /></div>
        {exams.loading ? <Loading /> : filtered.length === 0 ? <EmptyState title="Belum ada ujian" description="Buat ujian pertama Anda." /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>Ujian</th><th>Jadwal</th><th>Soal</th><th>Peserta</th><th>Selesai</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{filtered.map((exam) => (
              <tr key={exam.id}>
                <td className="font-semibold">{exam.name}<span className="block text-xs font-normal text-slate-500">{exam.description}</span></td>
                <td className="whitespace-nowrap text-xs">{formatDateTime(exam.startAt)}<span className="block">{formatDateTime(exam.endAt)}</span></td>
                <td>{exam.questionCount}</td>
                <td>{assignments.data.filter((item) => item.examId === exam.id).length}</td>
                <td>{attempts.data.filter((item) => item.examId === exam.id && item.status !== 'in_progress').length}</td>
                <td><Badge tone={exam.status === 'active' ? 'green' : exam.status === 'draft' ? 'slate' : 'amber'}>{exam.status}</Badge></td>
                <td><div className="flex flex-wrap gap-1">
                  <Link className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Lihat hasil" to={`/guru/hasil?exam=${exam.id}`}><Eye className="h-4 w-4" /></Link>
                  <Link className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit" to={`/guru/buat-ujian?edit=${exam.id}`}><Pencil className="h-4 w-4" /></Link>
                  <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Duplikasi" disabled={busy} onClick={() => void duplicate(exam)}><Copy className="h-4 w-4" /></button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void gradeAll(exam)}>Nilai otomatis</Button>
                  <button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Hapus" onClick={() => setDeleting(exam)}><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <ConfirmDialog open={Boolean(deleting)} title="Hapus ujian" message={`Hapus ujian "${deleting?.name}" beserta soal dan penugasan terkait? Ujian yang sudah dikerjakan tidak dapat dihapus.`} onClose={() => setDeleting(null)} onConfirm={removeExam} loading={busy} />
    </div>
  );
}
