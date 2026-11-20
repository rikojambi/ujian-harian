import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EntityManager, ActiveBadge } from '@/components/EntityManager';
import { useApp } from '@/contexts/AppContext';
import { useCollection } from '@/hooks/useCollection';
import { authService } from '@/services/auth/service';
import { db, isLocalMode } from '@/services/db';
import { COLLECTIONS, createEntity } from '@/services/repository';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Loading, Modal, PageHeader, Select } from '@/components/ui';
import { emailSchema, firstError, passwordSchema } from '@/utils/validation';
import type { AcademicYear, SchoolClass, Student } from '@/types';

function StudentsTab() {
  const { notify } = useApp();
  const students = useCollection<Student>(COLLECTIONS.students);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', nis: '', classId: '' });
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedEmail = emailSchema.safeParse(form.email);
    const parsedPassword = passwordSchema.safeParse(form.password);
    if (!parsedEmail.success || !parsedPassword.success) {
      setError(firstError(parsedEmail.success ? parsedPassword.error! : parsedEmail.error));
      return;
    }
    setSaving(true);
    try {
      if (!isLocalMode) throw new Error('Mode Firebase: buat akun siswa melalui npm run users:create (Admin SDK).');
      const created = await authService.signUp(form.email, form.password, form.name, 'student', false);
      authService.notifyLocalAuthChange();
      await db.update(COLLECTIONS.users, created.uid, { role: 'student', active: true });
      await createEntity(COLLECTIONS.students, {
        uid: created.uid, name: form.name, email: form.email, nis: form.nis, classId: form.classId, active: true
      } as unknown as Record<string, unknown>, created.uid, created.uid);
      notify('Akun siswa dibuat.', 'success');
      setOpen(false);
      await students.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Gagal membuat akun siswa.'); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <p className="section-title">Data Siswa</p>
        <Button onClick={() => { setForm({ name: '', email: '', password: '', nis: '', classId: '' }); setError(''); setOpen(true); }}><Plus className="h-4 w-4" /> Tambah siswa</Button>
      </div>
      {students.loading ? <Loading /> : students.data.length === 0 ? <EmptyState title="Belum ada siswa" /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th>Nama</th><th>NIS</th><th>Email</th><th>Kelas</th><th>Status</th><th /></tr></thead>
          <tbody>{students.data.map((student) => <tr key={student.id}>
            <td className="font-semibold">{student.name}</td><td>{student.nis}</td><td>{student.email}</td>
            <td>{classes.data.find((item) => item.id === student.classId)?.name ?? '—'}</td>
            <td><Badge tone={student.active ? 'green' : 'slate'}>{student.active ? 'Aktif' : 'Nonaktif'}</Badge></td>
            <td><button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => setDeleting(student)} aria-label="Hapus"><Trash2 className="h-4 w-4" /></button></td>
          </tr>)}</tbody>
        </table></div>
      )}
      <Modal open={open} title="Tambah siswa" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nama lengkap" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Input label="NIS" value={form.nis} onChange={(event) => setForm({ ...form, nis: event.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Input label="Kata sandi awal" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          <Select label="Kelas" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} required>
            <option value="">— Pilih kelas —</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving}>Simpan</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} title="Hapus siswa" message={`Nonaktifkan akun ${deleting?.name}?`} confirmLabel="Nonaktifkan" onClose={() => setDeleting(null)} loading={saving} onConfirm={async () => {
        if (!deleting) return;
        setSaving(true);
        try {
          await db.update(COLLECTIONS.students, deleting.id, { active: false });
          await db.update(COLLECTIONS.users, deleting.uid, { active: false });
          notify('Siswa dinonaktifkan.', 'success'); setDeleting(null); await students.refresh();
        } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal.', 'error'); }
        finally { setSaving(false); }
      }} />
    </Card>
  );
}

export default function ClassesStudentsPage() {
  const years = useCollection<AcademicYear>(COLLECTIONS.academicYears);
  const [tab, setTab] = useState<'classes' | 'students'>('classes');
  return (
    <div>
      <PageHeader title="Kelas dan Siswa" description="Kelola kelas, wali kelas, serta data siswa peserta ujian." />
      <div className="mb-4 flex gap-2">
        <button className={`btn ${tab === 'classes' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('classes')}>Kelas</button>
        <button className={`btn ${tab === 'students' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('students')}>Siswa</button>
      </div>
      {tab === 'classes' ? <EntityManager
        title="Daftar Kelas" collection={COLLECTIONS.classes} addLabel="Tambah kelas"
        fields={[
          { key: 'name', label: 'Nama kelas', required: true }, { key: 'level', label: 'Tingkat', required: true },
          { key: 'major', label: 'Jurusan' },
          { key: 'academicYearId', label: 'Tahun ajaran', type: 'select', options: years.data.map((item) => ({ value: item.id, label: item.name })) },
          { key: 'active', label: 'Aktif', type: 'checkbox', defaultValue: true }
        ]}
        columns={[{ key: 'name', label: 'Kelas' }, { key: 'level', label: 'Tingkat' }, { key: 'major', label: 'Jurusan' }, { key: 'active', label: 'Status', render: (row) => <ActiveBadge value={row.active} /> }]}
      /> : <StudentsTab />}
    </div>
  );
}
