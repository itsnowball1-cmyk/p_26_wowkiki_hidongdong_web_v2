import { useEffect } from 'react'
import ChildManagement from './pages/ChildManagement'
import ChildDetail from './pages/ChildDetail'
import DiagnosisDetail from './pages/DiagnosisDetail'
import TreatmentDetail from './pages/TreatmentDetail'
import MyPage from './pages/MyPage'
import ScheduleList from './pages/ScheduleList'
import ScheduleNew from './pages/ScheduleNew'
import ChildCustomList from './pages/ChildCustomList'
import ChildCustomDetail from './pages/ChildCustomDetail'
import NoticeList from './pages/NoticeList'
import NoticeDetail from './pages/NoticeDetail'
import FaqList from './pages/FaqList'
import FaqDetail from './pages/FaqDetail'
import SupportList from './pages/SupportList'
import SupportNew from './pages/SupportNew'
import SupportDetail from './pages/SupportDetail'
import AdminChildList from './pages/AdminChildList'
import AdminChildDetail from './pages/AdminChildDetail'
import AdminDeletedChildren from './pages/AdminDeletedChildren'
import AdminChildHistory from './pages/AdminChildHistory'
import AdminChildHistoryDetail from './pages/AdminChildHistoryDetail'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminMemberList from './pages/AdminMemberList'
import AdminMemberDetail from './pages/AdminMemberDetail'
import AdminMemberDeletedList from './pages/AdminMemberDeletedList'
import LoginPage from './pages/LoginPage'
import FindIdPage from './pages/FindIdPage'
import SignupPage from './pages/SignupPage'
import SignupTermsPage from './pages/SignupTermsPage'
import SignupFormPage from './pages/SignupFormPage'
import AdminSignupFormPage from './pages/AdminSignupFormPage'
import SignupRejectedPage from './pages/SignupRejectedPage'
import SignupSupplementPage from './pages/SignupSupplementPage'
import InstitutionPendingPage from './pages/InstitutionPendingPage'
import InstitutionRejectedPage from './pages/InstitutionRejectedPage'
import IadminSupplementPage from './pages/IadminSupplementPage'
import TherapistPendingPage from './pages/TherapistPendingPage'
import { RouterProvider, useRouter } from './lib/router'
import { AuthProvider, useAuth } from './lib/auth'

function Routes() {
  const { route, go } = useRouter()
  const { user } = useAuth()

  const isAuthRoute =
    route.name === 'login' ||
    route.name === 'find-id' ||
    route.name === 'signup' ||
    route.name === 'signup-terms' ||
    route.name === 'signup-form' ||
    route.name === 'signup-rejected' ||
    route.name === 'signup-supplement'

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!user && !isAuthRoute) {
      go({ name: 'login' })
    } else if (user && isAuthRoute) {
      go(isAdmin ? { name: 'admin-dashboard' } : { name: 'dashboard' })
    }
  }, [user, isAuthRoute])

  // 미인증
  if (!user) {
    if (route.name === 'find-id') return <FindIdPage />
    if (route.name === 'signup') return <SignupPage />
    if (route.name === 'signup-terms') return <SignupTermsPage role={route.role} />
    if (route.name === 'signup-form') {
      if (route.role === 'admin') return <AdminSignupFormPage />
      return <SignupFormPage role={route.role} />
    }
    if (route.name === 'signup-rejected') return <SignupRejectedPage />
    if (route.name === 'signup-supplement') return <SignupSupplementPage />
    return <LoginPage />
  }

  // 승인 대기 중
  if (user.approvalStatus === 'pending') {
    if (route.name === 'support-list') return <SupportList />
    if (route.name === 'support-new') return <SupportNew />
    if (route.name === 'support-detail') return <SupportDetail id={route.id} />
    if (user.role === 'therapist') return <TherapistPendingPage />
    return <InstitutionPendingPage />
  }

  // 반려
  if (user.approvalStatus === 'rejected') {
    if (route.name === 'support-list') return <SupportList />
    if (route.name === 'support-new') return <SupportNew />
    if (route.name === 'support-detail') return <SupportDetail id={route.id} />
    if (user.role === 'therapist') {
      if (route.name === 'signup-supplement') return <SignupSupplementPage />
      return <SignupRejectedPage />
    }
    if (route.name === 'iadmin-supplement') return <IadminSupplementPage />
    return <InstitutionRejectedPage />
  }

  // 공통 라우트 (모든 역할)
  if (route.name === 'mypage') return <MyPage />
  if (route.name === 'schedule-new') return <ScheduleNew />
  if (route.name === 'schedule-list') return <ScheduleList />
  if (route.name === 'notice-list') return <NoticeList />
  if (route.name === 'notice-detail') return <NoticeDetail id={route.id} />
  if (route.name === 'faq-list') return <FaqList />
  if (route.name === 'faq-detail') return <FaqDetail id={route.id} />
  if (route.name === 'support-list') return <SupportList />
  if (route.name === 'support-new') return <SupportNew />
  if (route.name === 'support-detail') return <SupportDetail id={route.id} />

  // 어드민 전용 라우트
  if (isAdmin) {
    if (route.name === 'admin-dashboard') return <AdminDashboard />
    if (isAuthRoute || route.name === 'list' || route.name === 'admin-children') return <AdminChildList />
    if (route.name === 'admin-child-detail') return <AdminChildDetail id={route.id} memberId={route.memberId} />
    if (route.name === 'admin-deleted-children') return <AdminDeletedChildren />
    if (route.name === 'admin-child-history') return <AdminChildHistory />
    if (route.name === 'admin-child-history-detail') return <AdminChildHistoryDetail id={route.id} />
    if (route.name === 'diagnosis') return <DiagnosisDetail childId={route.childId} diagnosisId={route.diagnosisId} />
    if (route.name === 'treatment') return <TreatmentDetail childId={route.childId} treatmentId={route.treatmentId} />
    if (route.name === 'admin-members') return <AdminMemberList />
    if (route.name === 'admin-member-detail') return <AdminMemberDetail id={route.id} />
    if (route.name === 'admin-member-deleted') return <AdminMemberDeletedList />
    return <AdminChildList />
  }

  // 의사/치료사 라우트
  if (route.name === 'dashboard') return <Dashboard />
  if (isAuthRoute) return <Dashboard />
  if (route.name === 'diagnosis') return <DiagnosisDetail childId={route.childId} diagnosisId={route.diagnosisId} />
  if (route.name === 'treatment') return <TreatmentDetail childId={route.childId} treatmentId={route.treatmentId} />
  if (route.name === 'detail') return <ChildDetail id={route.id} />
  if (route.name === 'custom-detail') return <ChildCustomDetail id={route.id} />
  if (route.name === 'custom-list') return <ChildCustomList />
  if (route.name === 'list') return <ChildManagement />
  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <Routes />
      </RouterProvider>
    </AuthProvider>
  )
}
