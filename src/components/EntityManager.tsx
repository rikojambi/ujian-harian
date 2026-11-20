import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCollection, useDebounce } from '@/hooks/useCollection';
import { db } from '@/services/db';
import { COLLECTIONS, createEntity, updateEntity } from '@/services/repository';
import { nanoid } from '@/utils/id';
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, ErrorState, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea } from '@/components/ui';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  hidden?: boolean;
  defaultValue?: string | number | boolean;
}

export interface ColumnDef { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }

interface Props {
  title: string;
  description?: string;
  collection: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  searchKeys?: string[];
  extraData?: Record<string, unknown>;
  canDelete?: (row: Record<string, unknown>) => boolean;
  addLabel?: string;
  pageSize?: number;
}

export function EntityManager({ title, description, collection, fields, columns, searchKeys = ['name'], extraData = {}, canDelete = () => true, addLabel = 'Tambah', pageSize = 10 }: Props) {
  const { profile, notify } = useApp();
  const { data, loading, error, refresh } = useCollection<Record<string, unknown>>(collection);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState('');

  const actorId = profile?.uid ?? 'system';
  const filtered = useMemo(() => data.filter((row) => {
    if (!debounced) return true;
    const needle = debounced.toLocaleLowerCase('id-ID');
    return searchKeys.some((key) => String(row[key] ?? '').toLocaleLowerCase('id-ID').includes(needle));
  }), [data, debounced, searchKeys]);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const openForm = (row: Record<string, unknown> | null) => {
    setEditing(row);
    setValues(row ? { ...row } : Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? (field.type === 'checkbox' ? false : '')])));
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing = fields.find((field) => field.required && !String(values[field.key] ?? '').trim());
    if (missing) { setFormError(`${missing.label} wajib diisi.`); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        if (field.hidden) continue;
        const value = values[field.key];
        payload[field.key] = field.type === 'number' ? Number(value) : value;
      }
      if (editing) await updateEntity(collection, String(editing.id), { ...payload, ...extraData }, actorId);
      else await createEntity(collection, { ...payload, ...extraData }, actorId, collection === COLLECTIONS.questionBanks ? nanoid() : undefined);
      notify(editing ? 'Perubahan disimpan.' : 'Data berhasil ditambahkan.', 'success');
      setFormOpen(false);
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await db.remove(collection, String(deleting.id));
      notify('Data dihapus.', 'success');
      setDeleting(null);
      await refresh();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Gagal menghapus data.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;

  return (
    <div>
      <PageHeader title={title} description={description} actions={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" /> {addLabel}</Button>} />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(0); }} placeholder="Cari data…" />
          <span className="text-xs text-slate-500">{filtered.length} entitas</span>
        </div>
        {loading ? <Loading /> : filtered.length === 0 ? <EmptyState title="Belum ada data" description="Tambahkan entitas baru menggunakan tombol di atas." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Aksi</th></tr></thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={String(row.id)}>
                    {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? '—')}</td>)}
                    <td>
                      <div className="flex gap-1">
                        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => openForm(row)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                        {canDelete(row) && <button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => setDeleting(row)} aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>Halaman {page + 1} dari {Math.ceil(filtered.length / pageSize)}</span>
            <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</Button><Button size="sm" variant="secondary" disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage(page + 1)}>Berikutnya</Button></div>
          </div>
        )}
      </Card>

      <Modal open={formOpen} title={editing ? 'Edit data' : `Tambah ${title.toLowerCase()}`} onClose={() => setFormOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          {fields.filter((field) => !field.hidden).map((field) => (
            <div key={field.key}>
              {field.type === 'checkbox' ? (
                <Checkbox label={field.label} checked={Boolean(values[field.key])} onChange={(event) => setValues({ ...values, [field.key]: event.target.checked })} />
              ) : field.type === 'select' ? (
                <Select label={field.label} value={String(values[field.key] ?? '')} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} required={field.required}>
                  <option value="">— Pilih —</option>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              ) : field.type === 'textarea' ? (
                <Textarea label={field.label} value={String(values[field.key] ?? '')} placeholder={field.placeholder} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} required={field.required} />
              ) : (
                <Input label={field.label} type={field.type ?? 'text'} value={String(values[field.key] ?? '')} placeholder={field.placeholder} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} required={field.required} />
              )}
            </div>
          ))}
          {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button type="submit" loading={saving}>Simpan</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="Konfirmasi hapus" message={`Hapus "${String(deleting?.name ?? deleting?.code ?? 'data ini')}"? Tindakan ini tidak dapat dibatalkan.`} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={saving} />
    </div>
  );
}

export function ActiveBadge({ value }: { value: unknown }) {
  return value ? <Badge tone="green">Aktif</Badge> : <Badge tone="slate">Nonaktif</Badge>;
}
