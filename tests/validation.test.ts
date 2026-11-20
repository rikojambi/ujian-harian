import { describe, expect, it } from 'vitest';
import {
  emailSchema, examSchema, firstError, loginSchema, namedEntitySchema,
  passwordSchema, questionSchema, registerSchema
} from '@/utils/validation';

const validQuestion = {
  code: 'MTK-001',
  prompt: 'Berapakah hasil 2 + 2?',
  subjectId: 'subject-1',
  classId: 'class-1',
  material: 'Operasi hitung',
  learningObjectiveIds: ['tp-1'],
  type: 'multiple_choice',
  correctAnswers: ['B'],
  explanation: 'Dua ditambah dua sama dengan empat.',
  weight: 10,
  difficulty: 'mudah'
};

const validExam = {
  name: 'Ujian Harian Matematika',
  subjectId: 'subject-1',
  classId: 'class-1',
  startAt: '2026-11-20T07:00:00.000Z',
  endAt: '2026-11-20T08:00:00.000Z',
  durationMinutes: 60,
  maxAttempts: 1,
  passingScore: 75
};

describe('validasi formulir', () => {
  it('memvalidasi email dan kata sandi', () => {
    expect(emailSchema.safeParse('guru@sekolah.sch.id').success).toBe(true);
    expect(emailSchema.safeParse('bukan-email').success).toBe(false);
    expect(passwordSchema.safeParse('rahasia').success).toBe(true);
    expect(passwordSchema.safeParse('12345').success).toBe(false);
  });

  it('memvalidasi login dan registrasi', () => {
    expect(loginSchema.safeParse({ email: 'siswa@sekolah.sch.id', password: 'rahasia' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'salah', password: 'rahasia' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'siswa@sekolah.sch.id', password: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'Siswa Satu', email: 'siswa@sekolah.sch.id', password: 'rahasia' }).success).toBe(true);
    expect(registerSchema.safeParse({ name: 'A', email: 'siswa@sekolah.sch.id', password: 'rahasia' }).success).toBe(false);
  });

  it('memvalidasi entitas bernama dan soal', () => {
    expect(namedEntitySchema.safeParse({ name: 'Kelas X TKJ 1' }).success).toBe(true);
    expect(namedEntitySchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(questionSchema.safeParse(validQuestion).success).toBe(true);
    expect(questionSchema.safeParse({ ...validQuestion, learningObjectiveIds: [] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...validQuestion, correctAnswers: [] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...validQuestion, weight: 101 }).success).toBe(false);
  });

  it('memvalidasi jadwal ujian dan memastikan selesai setelah mulai', () => {
    expect(examSchema.safeParse(validExam).success).toBe(true);
    expect(examSchema.safeParse({ ...validExam, durationMinutes: 0 }).success).toBe(false);
    expect(examSchema.safeParse({ ...validExam, maxAttempts: 1.5 }).success).toBe(false);
    const invalidWindow = examSchema.safeParse({ ...validExam, endAt: validExam.startAt });
    expect(invalidWindow.success).toBe(false);
    if (!invalidWindow.success) {
      expect(firstError(invalidWindow.error)).toBe('Waktu selesai harus setelah waktu mulai');
    }
  });

  it('mengambil pesan kesalahan pertama dari Zod', () => {
    const result = emailSchema.safeParse('bukan-email');
    expect(result.success).toBe(false);
    if (!result.success) expect(firstError(result.error)).toBe('Email tidak valid');
  });
});
