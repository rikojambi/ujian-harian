import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { AppLayout } from '@/layouts/AppLayout';
import { ToastHost } from '@/components/ui/ToastHost';
import { Card, EmptyState, Loading } from '@/components/ui';
import { LoginPage } from '@/pages/LoginPage';
import { SetupPage } from '@/pages/SetupPage';
import AdminDashboard from '@/pages/admin/Dashboard';
import UsersPage from '@/pages/admin/UsersPage';
import AdminClassesPage from '@/pages/admin/ClassesPage';
import AdminSubjectsPage from '@/pages/admin/SubjectsPage';
import AcademicYearPage from '@/pages/admin/AcademicYearPage';
import AdminExamsPage from '@/pages/admin/ExamsPage';
import AdminSettingsPage from '@/pages/admin/SettingsPage';
import TeacherDashboard from '@/pages/teacher/Dashboard';
import BankSoalPage from '@/pages/teacher/BankSoalPage';
import QuestionFormPage from '@/pages/teacher/QuestionFormPage';
import ImportPage from '@/pages/teacher/ImportPage';
import ObjectivesPage from '@/pages/teacher/ObjectivesPage';
import TeacherSubjectsPage from '@/pages/teacher/SubjectsPage';
import ClassesStudentsPage from '@/pages/teacher/ClassesStudentsPage';
import ExamCreatePage from '@/pages/teacher/ExamCreatePage';
import ExamsPage from '@/pages/teacher/ExamsPage';
import ResultsPage from '@/pages/teacher/ResultsPage';
import ItemAnalysisPage from '@/pages/teacher/ItemAnalysisPage';
import StudentAnalysisPage from '@/pages/teacher/StudentAnalysisPage';
import ReportsPage from '@/pages/teacher/ReportsPage';
import TeacherSettingsPage from '@/pages/teacher/SettingsPage';
import StudentDashboard from '@/pages/student/Dashboard';
import ExamListPage from '@/pages/student/ExamListPage';
import ExamPage from '@/pages/student/ExamPage';
import ResultPage from '@/pages/student/ResultPage';
import StudentSettingsPage from '@/pages/student/SettingsPage';
import type { Role } from '@/types';

function HomeRedirect() {
  const { role, loading } = useApp();
  if (loading) return <Loading />;
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'admin' ? '/admin' : role === 'teacher' ? '/guru' : '/siswa'} replace />;
}

function RequireRole({ roles }: { roles: Role[] }) {
  const { user, role, loading } = useApp();
  const location = useLocation();
  useEffect(() => { document.title = 'UJIAN HARIAN'; }, []);
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!role || !roles.includes(role)) return (
    <Card className="mx-auto mt-10 max-w-lg"><EmptyState title="Akses ditolak" description="Akun Anda tidak memiliki hak akses untuk halaman ini." /></Card>
  );
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<RequireRole roles={['admin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/pengguna" element={<UsersPage />} />
              <Route path="/admin/kelas" element={<AdminClassesPage />} />
              <Route path="/admin/mata-pelajaran" element={<AdminSubjectsPage />} />
              <Route path="/admin/tahun-ajaran" element={<AcademicYearPage />} />
              <Route path="/admin/ujian" element={<AdminExamsPage />} />
              <Route path="/admin/pengaturan" element={<AdminSettingsPage />} />
            </Route>
          </Route>

          <Route element={<RequireRole roles={['teacher', 'admin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/guru" element={<TeacherDashboard />} />
              <Route path="/guru/bank-soal" element={<BankSoalPage />} />
              <Route path="/guru/soal/:id" element={<QuestionFormPage />} />
              <Route path="/guru/soal/baru" element={<QuestionFormPage />} />
              <Route path="/guru/import" element={<ImportPage />} />
              <Route path="/guru/tp" element={<ObjectivesPage />} />
              <Route path="/guru/mata-pelajaran" element={<TeacherSubjectsPage />} />
              <Route path="/guru/kelas" element={<ClassesStudentsPage />} />
              <Route path="/guru/buat-ujian" element={<ExamCreatePage />} />
              <Route path="/guru/ujian" element={<ExamsPage />} />
              <Route path="/guru/hasil" element={<ResultsPage />} />
              <Route path="/guru/analisis-butir" element={<ItemAnalysisPage />} />
              <Route path="/guru/analisis-siswa" element={<StudentAnalysisPage />} />
              <Route path="/guru/laporan" element={<ReportsPage />} />
              <Route path="/guru/pengaturan" element={<TeacherSettingsPage />} />
            </Route>
          </Route>

          <Route element={<RequireRole roles={['student']} />}>
            <Route element={<AppLayout />}>
              <Route path="/siswa" element={<StudentDashboard />} />
              <Route path="/siswa/ujian" element={<ExamListPage />} />
              <Route path="/siswa/ujian/:examId" element={<ExamPage />} />
              <Route path="/siswa/hasil" element={<ExamListPage />} />
              <Route path="/siswa/hasil/:examId" element={<ResultPage />} />
              <Route path="/siswa/pengaturan" element={<StudentSettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastHost />
      </AppProvider>
    </BrowserRouter>
  );
}
