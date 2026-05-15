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
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import SignupTermsPage from './pages/SignupTermsPage'
import SignupFormPage from './pages/SignupFormPage'
import { RouterProvider, useRouter } from './lib/router'
import { AuthProvider, useAuth } from './lib/auth'

function Routes() {
  const { route, go } = useRouter()
  const { user } = useAuth()

  const isAuthRoute =
    route.name === 'login' ||
    route.name === 'signup' ||
    route.name === 'signup-terms' ||
    route.name === 'signup-form'

  useEffect(() => {
    if (!user && !isAuthRoute) {
      go({ name: 'login' })
    } else if (user && isAuthRoute) {
      go({ name: 'list' })
    }
  }, [user, isAuthRoute])

  // 미인증
  if (!user) {
    if (route.name === 'signup') return <SignupPage />
    if (route.name === 'signup-terms') return <SignupTermsPage role={route.role} />
    if (route.name === 'signup-form') return <SignupFormPage role={route.role} />
    return <LoginPage />
  }

  // 인증됨
  if (isAuthRoute) return <ChildManagement />
  if (route.name === 'diagnosis') return <DiagnosisDetail childId={route.childId} diagnosisId={route.diagnosisId} />
  if (route.name === 'treatment') return <TreatmentDetail childId={route.childId} treatmentId={route.treatmentId} />
  if (route.name === 'detail') return <ChildDetail id={route.id} />
  if (route.name === 'custom-detail') return <ChildCustomDetail id={route.id} />
  if (route.name === 'custom-list') return <ChildCustomList />
  if (route.name === 'mypage') return <MyPage />
  if (route.name === 'schedule-new') return <ScheduleNew />
  if (route.name === 'schedule-list') return <ScheduleList />
  return <ChildManagement />
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
