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
    case 'institutions':     return <InstitutionsPage />
    case 'institution-detail': return <InstitutionDetailPage id={route.id} />
    case 'children':         return <PlaceholderPage title="아동관리" />
    case 'stats':            return <StatsPage />
    case 'notices':          return <NoticesPage />
    case 'faq':              return <FAQPage />
    case 'cs':               return <CsPage />
    case 'sms-settings':     return <SmsSettingsPage />
    case 'security':         return <PlaceholderPage title="보안" />
    case 'content':          return <PlaceholderPage title="콘텐츠" />
    case 'versions':         return <PlaceholderPage title="버전관리" />
    case 'data':             return <PlaceholderPage title="데이터" />
    case 'mypage':           return <PlaceholderPage title="마이페이지" />
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
