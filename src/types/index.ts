export type Role = 'admin' | 'teacher' | 'student';
export type QuestionType = 'multiple_choice' | 'multiple_response' | 'completion';
export type ExamStatus = 'draft' | 'scheduled' | 'active' | 'closed' | 'archived';
export type AttemptStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'awaiting_review'
  | 'graded'
  | 'published';
export type GradingMethod = 'exact_match' | 'partial_credit';
export type Difficulty = 'mudah' | 'sedang' | 'sukar';

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface BaseEntity extends Timestamps {
  id: string;
}

export interface UserProfile extends BaseEntity {
  uid: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  avatarUrl?: string;
  phone?: string;
}

export interface Teacher extends BaseEntity {
  uid: string;
  name: string;
  email: string;
  subjectIds: string[];
  classIds: string[];
  active: boolean;
}

export interface Student extends BaseEntity {
  uid: string;
  name: string;
  email: string;
  nis: string;
  classId: string;
  active: boolean;
}

export interface SchoolClass extends BaseEntity {
  name: string;
  level: string;
  major?: string;
  academicYearId: string;
  homeroomTeacherId?: string;
  active: boolean;
}

export interface Subject extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  active: boolean;
}

export interface AcademicYear extends BaseEntity {
  name: string;
  semester: 'ganjil' | 'genap';
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface Enrollment extends BaseEntity {
  studentId: string;
  classId: string;
  academicYearId: string;
  active: boolean;
}

export interface LearningObjective extends BaseEntity {
  code: string;
  description: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  semester: 'ganjil' | 'genap';
  material: string;
  active: boolean;
}

export interface MediaAsset {
  id: string;
  type: 'image' | 'audio' | 'video';
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  source: 'external' | 'local';
  compressed?: boolean;
}

export interface QuestionOption {
  id: string;
  key: string;
  text: string;
  image?: MediaAsset;
  isCorrect: boolean;
}

export interface Question extends BaseEntity {
  code: string;
  bankId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  semester: 'ganjil' | 'genap';
  material: string;
  learningObjectiveIds: string[];
  type: QuestionType;
  prompt: string;
  stimulus?: string;
  media?: MediaAsset[];
  options: QuestionOption[];
  correctAnswers: string[];
  acceptedAnswers: string[];
  explanation: string;
  explanationMedia?: MediaAsset[];
  explanationAvailableAt?: string;
  difficulty: Difficulty;
  weight: number;
  gradingMethod: GradingMethod;
  partialCreditRule?: {
    penaltyPerWrong: number;
    minScore: number;
    allowNegative: boolean;
  };
  whitespaceTolerance: 'strict' | 'ignore_edges' | 'collapse_all';
  requiresManualReview: boolean;
  status: 'active' | 'inactive' | 'archived';
  teacherId: string;
  tags: string[];
}

export interface QuestionBank extends BaseEntity {
  name: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  semester: 'ganjil' | 'genap';
  description?: string;
  teacherId: string;
  active: boolean;
}

export interface ExamQuestion {
  questionId: string;
  order: number;
  weight: number;
}

export interface Exam extends BaseEntity {
  name: string;
  description: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  semester: 'ganjil' | 'genap';
  startAt: string;
  endAt: string;
  durationMinutes: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  maxAttempts: number;
  navigationMode: 'free' | 'sequential';
  autosave: boolean;
  showResultImmediately: boolean;
  status: ExamStatus;
  teacherId: string;
  totalWeight: number;
  questionCount: number;
  passingScore: number;
  explanationMode: 'on_publish' | 'scheduled';
  explanationAvailableAt?: string;
}

export interface ExamQuestionLink extends BaseEntity {
  examId: string;
  questionId: string;
  order: number;
  weight: number;
  // Salinan kunci hanya untuk sisi guru; tidak pernah dikirim ke siswa.
  answerKey: string[];
  type: QuestionType;
  learningObjectiveIds: string[];
}

/** Salinan soal tanpa kunci/pembahasan untuk perangkat siswa. */
export interface StudentQuestionDoc extends BaseEntity {
  examId: string;
  questionId: string;
  order: number;
  prompt: string;
  stimulus?: string;
  type: QuestionType;
  weight: number;
  media?: MediaAsset[];
  options: Array<{ id: string; key: string; text: string; image?: MediaAsset }>;
  learningObjectiveIds: string[];
}

/** Kunci dan pembahasan hanya dapat dibaca setelah publikasi (diatur pada security rules). */
export interface StudentExplanationDoc extends BaseEntity {
  examId: string;
  questionId: string;
  correctAnswers: string[];
  explanation: string;
  explanationMedia?: MediaAsset[];
  explanationAvailableAt?: string;
}

export interface ExamAssignment extends BaseEntity {
  examId: string;
  studentId: string;
  classId: string;
  assignedBy: string;
  group?: string;
  attemptCount: number;
}

export interface ExamAttempt extends BaseEntity {
  examId: string;
  studentId: string;
  assignmentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  finishedAt?: string;
  timeSpentSeconds: number;
  questionOrder: string[];
  optionOrder: Record<string, string[]>;
  currentQuestionIndex: number;
  flaggedQuestionIds: string[];
  lastSyncedAt?: string;
}

export interface ExamAnswer extends BaseEntity {
  attemptId: string;
  examId: string;
  studentId: string;
  questionId: string;
  answer: string[];
  markedForReview: boolean;
  answeredAt: string;
  updatedAtClient: string;
  synced: boolean;
}

export interface AnswerEvaluation {
  questionId: string;
  earned: number;
  max: number;
  correct: boolean;
  needsManualReview: boolean;
}

export interface ExamResult extends BaseEntity {
  attemptId: string;
  examId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  answers: AnswerEvaluation[];
  autoScore: number;
  finalScore: number;
  maxScore: number;
  passed: boolean;
  gradedBy: string;
  gradedAt: string;
  manualOverride?: number;
  note?: string;
  status: 'awaiting_review' | 'graded' | 'published';
  publishedAt?: string;
  publishedBy?: string;
}

export interface Publication extends BaseEntity {
  examId: string;
  classId?: string;
  /** Ditandai hanya pada dokumen gate per siswa: publications/{examId}_{studentId}. */
  studentId?: string;
  studentIds: string[];
  publishedBy: string;
  publishedAt: string;
  explanationAvailableAt?: string;
}

export interface ItemAnalysis extends BaseEntity {
  examId: string;
  questionId: string;
  sampleSize: number;
  difficultyIndex: number;
  difficultyCategory: 'sukar' | 'sedang' | 'mudah';
  discriminationIndex: number;
  discriminationCategory: 'sangat_baik' | 'baik' | 'cukup' | 'kurang' | 'bermasalah';
  pointBiserial: number;
  validityStatus: 'valid' | 'ragu' | 'tidak_valid';
  reliability?: {
    method: 'KR-20' | 'Cronbach Alpha';
    value: number;
    itemCount: number;
    sampleSize: number;
    interpretation: string;
    warning?: string;
  };
  distractors: Array<{ key: string; count: number; percentage: number; chosenByUpper: number; chosenByLower: number }>;
  recommendation: 'dipertahankan' | 'direvisi' | 'dibuang';
  notes: string[];
  computedAt: string;
}

export interface StudentAnalysis extends BaseEntity {
  studentId: string;
  subjectId: string;
  classId: string;
  learningObjectiveId: string;
  totalItems: number;
  correctItems: number;
  percentage: number;
  status: 'dikuasai' | 'perlu_penguatan' | 'perlu_remedial';
  evidenceSufficient: boolean;
  trend: Array<{ examId: string; date: string; percentage: number }>;
  computedAt: string;
}

export interface AuditLog extends BaseEntity {
  action: string;
  entity: string;
  entityId: string;
  actorId: string;
  details?: Record<string, unknown>;
}

export interface AppSettings extends BaseEntity {
  key: string;
  value: unknown;
}

export interface ImportDraftQuestion {
  tempId: string;
  number: number;
  prompt: string;
  options: Array<{ key: string; text: string; imageName?: string }>;
  answerKeys: string[];
  explanation: string;
  learningObjectiveCode?: string;
  type: QuestionType;
  mediaNames: string[];
  warnings: string[];
}

export interface ImportReport {
  fileName: string;
  format: 'docx' | 'rtf' | 'json';
  questions: ImportDraftQuestion[];
  unprocessedMedia: string[];
  warnings: string[];
}
