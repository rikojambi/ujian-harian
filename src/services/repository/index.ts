import { db } from '@/services/db';

export const COLLECTIONS = {
  users: 'users',
  teachers: 'teachers',
  students: 'students',
  classes: 'classes',
  subjects: 'subjects',
  academicYears: 'academic_years',
  enrollments: 'enrollments',
  learningObjectives: 'learning_objectives',
  questionBanks: 'question_banks',
  questions: 'questions',
  exams: 'exams',
  examQuestions: 'exam_questions',
  studentQuestions: 'student_questions',
  studentExplanations: 'student_explanations',
  assignments: 'exam_assignments',
  attempts: 'exam_attempts',
  answers: 'exam_answers',
  results: 'exam_results',
  itemAnalyses: 'item_analyses',
  studentAnalyses: 'student_analyses',
  publications: 'publications',
  auditLogs: 'audit_logs',
  settings: 'app_settings',
  media: 'media_assets'
} as const;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createPayload<T extends Record<string, unknown>>(data: T, actorId: string): T & {
  createdAt: string; updatedAt: string; createdBy: string; updatedBy: string;
} {
  const timestamp = nowIso();
  return { ...data, createdAt: timestamp, updatedAt: timestamp, createdBy: actorId, updatedBy: actorId };
}

export function updatePayload<T extends Record<string, unknown>>(data: T, actorId: string): T & {
  updatedAt: string; updatedBy: string;
} {
  return { ...data, updatedAt: nowIso(), updatedBy: actorId };
}

export async function createEntity<T extends Record<string, unknown>>(
  collection: string, data: T, actorId: string, id?: string
): Promise<string> {
  return db.create(collection, createPayload(data, actorId) as unknown as Record<string, unknown>, id);
}

export async function updateEntity(collection: string, id: string, patch: Record<string, unknown>, actorId: string): Promise<void> {
  await db.update(collection, id, updatePayload(patch, actorId));
}

export async function audit(actorId: string, action: string, entity: string, entityId: string, details?: Record<string, unknown>): Promise<void> {
  try {
    await createEntity(COLLECTIONS.auditLogs, {
      action, entity, entityId, actorId, details
    } as unknown as Record<string, unknown>, actorId);
  } catch {
    // Audit failure tidak boleh menggagalkan operasi utama.
  }
}
