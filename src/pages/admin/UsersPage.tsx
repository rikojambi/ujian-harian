import { useState, type FormEvent } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection, useDebounce } from '@/hooks/useCollection';
import { authService, digest } from '@/services/auth/service';
import { db, isLocalMode } from '@/services/db';
import { COLLECTIONS, createEntity, updateEntity } from '@/services/repository';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Loading, Modal, PageHeader, SearchInput, Select } from '@/components/ui';
import { emailSchema, firstError, passwordSchema } from '@/utils/validation';
import type { Role, SchoolClass, UserProfile } from '@/types';

export default function UsersPage() {
  const { notify, user } = useApp();
  const users = useCollection<UserProfile>(COLLECTIONS.users);
  const classes = useCollection<SchoolClass>(COLLECTIONS.classes);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' as Role, classId: '', nis: '' });
  const [error, setError] = useState('');

  const filtered = users.data.filter((item) => `${item.name} ${item.email} ${item.role}`.toLocaleLowerCase('id-ID').includes(debounced.toLocaleLowerCase('id-ID')));

  const openForm = (item: UserProfile | null) => {
    setEditing(item);
    setForm({ name: item?.name ?? '', email: item?.email ?? '', password: '', role: item?.role ?? 'student', classId: '', nis: '' });
    setError('');
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedEmail = emailSchema.safeParse(form.email);
    if (!parsedEmail.success) { setError(firstError(parsedEmail.error)); return; }
    if (!editing) {
      const parsedPassword = passwordSchema.safeParse(form.password);
      if (!parsedPassword.success) { setError(firstError(parsedPassword.error)); return; }
    }
    setSaving(true);
    try {
      if (editing) {
        const patch: Record<string, unknown> = { name: form.name };
        if (isLocalMode) patch.role = form.role;
        await updateEntity(COLLECTIONS.users, editing.id, patch, user?.uid ?? 'system');
        if (form.password) {
          if (!isLocalMode) throw new Error('Pengubahan kata sandi Firebase harus dilakukan oleh pengguna yang bersangkutan.');
          const credentials = await db.list<{ id: string; salt: string }>('credentials', { filters: [{ field: 'uid', op: '==', value: editing.uid }] });
          if (credentials[0]) {
            const salt = credentials[0].salt;
            await db.update('credentials', credentials[0].id, { salt, passwordHash: await digest(form.password, salt) });
          }
        }
      } else {
        if (!isLocalMode) throw new Error('Mode Firebase: buat akun melalui npm run users:create (Admin SDK).');
        const created = await authService.signUp(form.email, form.password, form.name, form.role, false);
        authService.notifyLocalAuthChange();
        await db.update(COLLECTIONS.users, created.uid, { role: form.role, active: true, updatedBy: user?.uid ?? 'system' });
        if (form.role === 'teacher') {
          await createEntity(COLLECTIONS.teachers, {
            uid: created.uid, name: form.name, email: form.email, subjectIds: [], classIds: [], active: true
          } as unknown as Record<string, unknown>, user?.uid ?? 'system', created.uid);
        }
        if (form.role === 'student') {
          await createEntity(COLLECTIONS.students, {
            uid: created.uid, name: form.name, email: form.email, nis: form.nis, classId: form.classId, active: true
          } as unknown as Record<string, unknown>, user?.uid ?? 'system', created.uid);
        }
      }
      notify(editing ? 'Akun diperbarui.' : 'Akun dibuat.', 'success');
      setOpen(false);
      await users.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal menyimpan akun.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Kelola Akun" description="Buat dan kelola akun admin, guru, dan siswa." actions={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Tambah akun</Button>} />
      <Card>
        <div className="border-b border-slate-100 p-4"><SearchInput value={query} onChange={setQuery} placeholder="Cari nama atau email…" /></div>
        {users.loading ? <Loading /> : filtered.length === 0 ? <EmptyState title="Belum ada akun" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{filtered.map((item) => <tr key={item.id}>
              <td className="font-semibold">{item.name}</td>
              <td>{item.email}</td>
              <td><Badge tone={item.role === 'admin' ? 'violet' : item.role === 'teacher' ? 'blue' : 'slate'}>{item.role}</Badge></td>
              <td><Badge tone={item.active ? 'green' : 'red'}>{item.active ? 'Aktif' : 'Nonaktif'}</Badge></td>
              <td><div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => openForm(item)}>Edit</Button>
                <button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => setDeleting(item)} aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </Card>
      <Modal open={open} title={editing ? 'Edit akun' : 'Tambah akun'} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nama lengkap" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Input label="Email" type="email" value={form.email} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          {!editing && <Input label="Kata sandi awal" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} hint="Minimal 6 karakter" required />}
          <Select
            label="Peran"
            value={form.role}
            disabled={Boolean(editing) && !isLocalMode}
            onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
          >
            <option value="student">Siswa</option><option value="teacher">Guru</option><option value="admin">Admin</option>
          </Select>
          {editing && !isLocalMode && (
            <p className="text-xs text-amber-700">
              Mode Firebase: peran tidak bisa diubah di sini. Jalankan <code>npm run users:role -- {editing.email} &lt;peran&gt;</code>, lalu minta pengguna masuk ulang.
            </p>
          )}
          {form.role === 'student' && !editing && <>
            <Input label="NIS" value={form.nis} onChange={(event) => setForm({ ...form, nis: event.target.value })} />
            <Select label="Kelas" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}>
              <option value="">— Pilih kelas —</option>{classes.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </>}
          <p className="flex items-center gap-1 text-xs text-slate-500"><KeyRound className="h-4 w-4" /> {isLocalMode ? 'Mode lokal: akun dibuat pada penyimpanan perangkat.' : editing ? 'Firebase: hanya nama yang bisa diubah di sini. Peran dan kata sandi dikelola lewat Admin SDK.' : 'Firebase: gunakan npm run users:create (Admin SDK) untuk membuat akun produksi dan custom claim peran.'}</p>
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" loading={saving}>Simpan</Button></div>
        </form>
      </Modal>
      {deleting && !isLocalMode && (
        <Modal open title="Nonaktifkan akun produksi" onClose={() => setDeleting(null)}>
          <p className="text-sm leading-relaxed text-slate-600">
            Akun <strong>{deleting.email}</strong> tidak bisa dinonaktifkan dari browser. Jalankan di komputer yang memiliki service account Firebase:
          </p>
          <code className="mt-3 block rounded-xl bg-slate-100 p-3 text-xs text-slate-800">npm run users:disable -- {deleting.email}</code>
          <p className="mt-3 text-xs text-slate-500">
            Perintah ini memblokir login Firebase Auth dan mencabut akses Firestore seketika, termasuk token yang masih aktif. Untuk mengaktifkan lagi: <code>npm run users:enable -- {deleting.email}</code>
          </p>
          <div className="mt-6 flex justify-end"><Button variant="secondary" onClick={() => setDeleting(null)}>Tutup</Button></div>
        </Modal>
      )}
      {isLocalMode && (
        <ConfirmDialog open={Boolean(deleting)} title="Nonaktifkan akun" message={`Nonaktifkan akun ${deleting?.name}? Data historis ujian tetap disimpan.`} onClose={() => setDeleting(null)} loading={saving} onConfirm={async () => {
          if (!deleting) return;
          setSaving(true);
          try {
            await db.update(COLLECTIONS.users, deleting.id, { active: false });
            notify('Akun dinonaktifkan.', 'success');
            setDeleting(null);
            await users.refresh();
          } catch (caught) { notify(caught instanceof Error ? caught.message : 'Gagal menonaktifkan akun.', 'error'); }
          finally { setSaving(false); }
        }} confirmLabel="Nonaktifkan" />
      )}
    </div>
  );
}
