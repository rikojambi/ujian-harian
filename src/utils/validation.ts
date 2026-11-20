import { z } from 'zod';

export const emailSchema = z.string().trim().email('Email tidak valid');
export const passwordSchema = z.string().min(6, 'Kata sandi minimal 6 karakter');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Kata sandi wajib diisi')
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter'),
  email: emailSchema,
  password: passwordSchema
});

export const namedEntitySchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter')
});

export const questionSchema = z.object({
  code: z.string().trim().min(1, 'Kode soal wajib diisi'),
  prompt: z.string().trim().min(3, 'Pertanyaan minimal 3 karakter'),
  subjectId: z.string().min(1, 'Mata pelajaran wajib dipilih'),
  classId: z.string().min(1, 'Kelas wajib dipilih'),
  material: z.string().trim().min(1, 'Materi wajib diisi'),
  learningObjectiveIds: z.array(z.string()).min(1, 'Minimal satu TP harus dipilih'),
  type: z.enum(['multiple_choice', 'multiple_response', 'completion']),
  correctAnswers: z.array(z.string()).min(1, 'Kunci jawaban wajib ditentukan'),
  explanation: z.string().trim().min(1, 'Pembahasan wajib diisi'),
  weight: z.coerce.number().min(1, 'Bobot minimal 1').max(100, 'Bobot maksimal 100'),
  difficulty: z.enum(['mudah', 'sedang', 'sukar'])
});

export const examSchema = z.object({
  name: z.string().trim().min(3, 'Nama ujian minimal 3 karakter'),
  subjectId: z.string().min(1, 'Mata pelajaran wajib dipilih'),
  classId: z.string().min(1, 'Kelas wajib dipilih'),
  startAt: z.string().min(1, 'Waktu mulai wajib diisi'),
  endAt: z.string().min(1, 'Waktu selesai wajib diisi'),
  durationMinutes: z.coerce.number().min(1, 'Durasi minimal 1 menit').max(600, 'Durasi maksimal 600 menit'),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  passingScore: z.coerce.number().min(0).max(100)
}).refine((value) => new Date(value.endAt) > new Date(value.startAt), {
  message: 'Waktu selesai harus setelah waktu mulai',
  path: ['endAt']
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Data tidak valid';
}
