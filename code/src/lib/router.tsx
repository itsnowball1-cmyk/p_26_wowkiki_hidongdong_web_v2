import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type SignupRole = 'admin' | 'doctor' | 'therapist'

type Route =
  | { name: 'dashboard' }
  | { name: 'list' }
  | { name: 'detail'; id: number }
  | { name: 'diagnosis'; childId: number; diagnosisId: number }
  | { name: 'treatment'; childId: number; treatmentId: number }
  | { name: 'custom-list' }
  | { name: 'custom-detail'; id: number }
  | { name: 'mypage' }
  | { name: 'schedule-list' }
  | { name: 'schedule-new' }
  | { name: 'faq-list' }
  | { name: 'faq-detail'; id: number }
  | { name: 'notice-list' }
  | { name: 'notice-detail'; id: number }
  | { name: 'support-list' }
  | { name: 'support-new' }
  | { name: 'support-detail'; id: number }
  | { name: 'admin-dashboard' }
  | { name: 'admin-children' }
  | { name: 'admin-child-detail'; id: number; memberId?: number }
  | { name: 'admin-deleted-children' }
  | { name: 'admin-child-history' }
  | { name: 'admin-child-history-detail'; id: number }
  | { name: 'admin-member-detail'; id: number }
  | { name: 'admin-member-deleted' }
  | { name: 'admin-members' }
  | { name: 'login' }
  | { name: 'signup' }
  | { name: 'signup-terms'; role: SignupRole }
  | { name: 'signup-form'; role: SignupRole }

type RouterValue = {
  route: Route
  go: (route: Route) => void
}

const RouterContext = createContext<RouterValue | null>(null)

function isRole(s: string): s is SignupRole {
  return s === 'admin' || s === 'doctor' || s === 'therapist'
}

function parseHash(hash: string): Route {
  const faqDetail = hash.match(/^#\/faq\/(\d+)/)
  if (faqDetail) return { name: 'faq-detail', id: Number(faqDetail[1]) }
  if (hash.startsWith('#/faq')) return { name: 'faq-list' }
  const noticeDetail = hash.match(/^#\/notice\/(\d+)/)
  if (noticeDetail) return { name: 'notice-detail', id: Number(noticeDetail[1]) }
  if (hash.startsWith('#/notice')) return { name: 'notice-list' }
  if (hash.startsWith('#/support/new')) return { name: 'support-new' }
  const supportDetail = hash.match(/^#\/support\/(\d+)/)
  if (supportDetail) return { name: 'support-detail', id: Number(supportDetail[1]) }
  if (hash.startsWith('#/support')) return { name: 'support-list' }
  if (hash.startsWith('#/dashboard')) return { name: 'dashboard' }
  if (hash.startsWith('#/admin/dashboard')) return { name: 'admin-dashboard' }
  if (hash.startsWith('#/admin/deleted')) return { name: 'admin-deleted-children' }
  const adminHistoryDetail = hash.match(/^#\/admin\/history\/child\/(\d+)/)
  if (adminHistoryDetail) return { name: 'admin-child-history-detail', id: Number(adminHistoryDetail[1]) }
  if (hash.startsWith('#/admin/history')) return { name: 'admin-child-history' }
  if (hash.startsWith('#/admin/members/deleted')) return { name: 'admin-member-deleted' }
  const adminMemberDetail = hash.match(/^#\/admin\/members\/(\d+)/)
  if (adminMemberDetail) return { name: 'admin-member-detail', id: Number(adminMemberDetail[1]) }
  if (hash.startsWith('#/admin/members')) return { name: 'admin-members' }
  const adminChildFromMember = hash.match(/^#\/admin\/child\/(\d+)\/from\/(\d+)/)
  if (adminChildFromMember) return { name: 'admin-child-detail', id: Number(adminChildFromMember[1]), memberId: Number(adminChildFromMember[2]) }
  const adminChildDetail = hash.match(/^#\/admin\/child\/(\d+)/)
  if (adminChildDetail) return { name: 'admin-child-detail', id: Number(adminChildDetail[1]) }
  if (hash.startsWith('#/admin')) return { name: 'admin-children' }
  if (hash.startsWith('#/login')) return { name: 'login' }
  const terms = hash.match(/^#\/signup\/terms\/(admin|doctor|therapist)/)
  if (terms && isRole(terms[1])) return { name: 'signup-terms', role: terms[1] }
  const form = hash.match(/^#\/signup\/form\/(admin|doctor|therapist)/)
  if (form && isRole(form[1])) return { name: 'signup-form', role: form[1] }
  if (hash.startsWith('#/signup')) return { name: 'signup' }
  const customDetail = hash.match(/^#\/custom\/(\d+)/)
  if (customDetail) return { name: 'custom-detail', id: Number(customDetail[1]) }
  if (hash.startsWith('#/custom')) return { name: 'custom-list' }
  if (hash.startsWith('#/mypage')) return { name: 'mypage' }
  if (hash.startsWith('#/schedule/new')) return { name: 'schedule-new' }
  if (hash.startsWith('#/schedule')) return { name: 'schedule-list' }
  const diag = hash.match(/^#\/child\/(\d+)\/diagnosis\/(\d+)/)
  if (diag) return { name: 'diagnosis', childId: Number(diag[1]), diagnosisId: Number(diag[2]) }
  const treat = hash.match(/^#\/child\/(\d+)\/treatment\/(\d+)/)
  if (treat) return { name: 'treatment', childId: Number(treat[1]), treatmentId: Number(treat[2]) }
  const m = hash.match(/^#\/child\/(\d+)/)
  if (m) return { name: 'detail', id: Number(m[1]) }
  return { name: 'list' }
}

function toHash(route: Route): string {
  if (route.name === 'faq-detail') return `#/faq/${route.id}`
  if (route.name === 'faq-list') return '#/faq'
  if (route.name === 'notice-detail') return `#/notice/${route.id}`
  if (route.name === 'notice-list') return '#/notice'
  if (route.name === 'support-new') return '#/support/new'
  if (route.name === 'support-detail') return `#/support/${route.id}`
  if (route.name === 'support-list') return '#/support'
  if (route.name === 'admin-deleted-children') return '#/admin/deleted'
  if (route.name === 'admin-child-history') return '#/admin/history'
  if (route.name === 'admin-child-history-detail') return `#/admin/history/child/${route.id}`
  if (route.name === 'admin-member-deleted') return '#/admin/members/deleted'
  if (route.name === 'admin-member-detail') return `#/admin/members/${route.id}`
  if (route.name === 'admin-members') return '#/admin/members'
  if (route.name === 'admin-child-detail') return route.memberId ? `#/admin/child/${route.id}/from/${route.memberId}` : `#/admin/child/${route.id}`
  if (route.name === 'dashboard') return '#/dashboard'
  if (route.name === 'admin-dashboard') return '#/admin/dashboard'
  if (route.name === 'admin-children') return '#/admin'
  if (route.name === 'login') return '#/login'
  if (route.name === 'signup-terms') return `#/signup/terms/${route.role}`
  if (route.name === 'signup-form') return `#/signup/form/${route.role}`
  if (route.name === 'signup') return '#/signup'
  if (route.name === 'custom-detail') return `#/custom/${route.id}`
  if (route.name === 'custom-list') return '#/custom'
  if (route.name === 'mypage') return '#/mypage'
  if (route.name === 'schedule-new') return '#/schedule/new'
  if (route.name === 'schedule-list') return '#/schedule'
  if (route.name === 'diagnosis') return `#/child/${route.childId}/diagnosis/${route.diagnosisId}`
  if (route.name === 'treatment') return `#/child/${route.childId}/treatment/${route.treatmentId}`
  if (route.name === 'detail') return `#/child/${route.id}`
  return '#/'
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (next: Route) => {
    setRoute(next)
    window.location.hash = toHash(next)
  }

  return <RouterContext.Provider value={{ route, go }}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
