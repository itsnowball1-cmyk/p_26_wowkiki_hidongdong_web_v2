import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type SignupRole = 'admin' | 'doctor' | 'therapist'

type Route =
  | { name: 'list' }
  | { name: 'detail'; id: number }
  | { name: 'diagnosis'; childId: number; diagnosisId: number }
  | { name: 'treatment'; childId: number; treatmentId: number }
  | { name: 'custom-list' }
  | { name: 'custom-detail'; id: number }
  | { name: 'mypage' }
  | { name: 'schedule-list' }
  | { name: 'schedule-new' }
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
    window.location.hash = toHash(next)
  }

  return <RouterContext.Provider value={{ route, go }}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
