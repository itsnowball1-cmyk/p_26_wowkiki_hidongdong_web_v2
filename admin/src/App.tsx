import { useEffect } from 'react'
import { RouterProvider, useRouter } from './lib/router'
import { AuthProvider, useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import InstitutionsPage from './pages/InstitutionsPage'
import InstitutionDetailPage from './pages/InstitutionDetailPage'
import StatsPage from './pages/StatsPage'
import NoticesPage from './pages/NoticesPage'
import FAQPage from './pages/FAQPage'
import CsPage from './pages/CsPage'
import SmsSettingsPage from './pages/SmsSettingsPage'
import TherapistsPage from './pages/TherapistsPage'
import ChildrenDataPage from './pages/ChildrenDataPage'
import ChildDetailPage from './pages/ChildDetailPage'
import DoctorsDataPage from './pages/DoctorsDataPage'
import InstitutionEntitiesPage from './pages/InstitutionEntitiesPage'
import InstitutionAdminsPage from './pages/InstitutionAdminsPage'
import InstitutionApprovalPage from './pages/InstitutionApprovalPage'
import MypagePage from './pages/MypagePage'
import TermsPage from './pages/TermsPage'
import Layout from './components/Layout'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <Layout title={title}>
      <div className="flex items-center justify-center h-[400px] text-[14px] text-[#B5B5B5]">
        준비 중입니다.
      </div>
    </Layout>
  )
}

function Routes() {
  const { route, go } = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (!user && route.name !== 'login') go({ name: 'login' })
    if (user && route.name === 'login') go({ name: 'dashboard' })
  }, [user, route.name])

  if (!user) return <LoginPage />

  switch (route.name) {
    case 'dashboard':        return <DashboardPage />
    case 'institutions':          return <InstitutionsPage />
    case 'institution-detail':    return <InstitutionDetailPage id={route.id} />
    case 'institution-approval':  return <InstitutionApprovalPage id={route.id} />
    case 'institution-entities':  return <InstitutionEntitiesPage />
    case 'institution-admins':    return <InstitutionAdminsPage />
    case 'children':         return <ChildrenDataPage />
    case 'child-detail':     return <ChildDetailPage id={route.id} />
    case 'stats':            return <StatsPage />
    case 'notices':          return <NoticesPage />
    case 'notice-write':     return <NoticesPage initialWrite={true} />
    case 'notice-detail':    return <NoticesPage initialIdx={Number(route.id)} />
    case 'faq':              return <FAQPage />
    case 'cs':               return <CsPage />
    case 'cs-detail':        return <CsPage initialIdx={Number(route.id)} />
    case 'sms-settings':     return <SmsSettingsPage />
    case 'therapists':       return <TherapistsPage />
    case 'doctors':          return <DoctorsDataPage />
    case 'security':         return <PlaceholderPage title="보안" />
    case 'security-child':    return <TermsPage role="child" />
    case 'security-iadmin':   return <TermsPage role="iadmin" />
    case 'security-doctor':   return <TermsPage role="doctor" />
    case 'security-therapist':return <TermsPage role="therapist" />
    case 'content':          return <PlaceholderPage title="콘텐츠" />
    case 'versions':         return <PlaceholderPage title="버전관리" />
    case 'data':             return <PlaceholderPage title="데이터" />
    case 'mypage':           return <MypagePage />
    default:                 return <DashboardPage />
  }
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
