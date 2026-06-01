import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type RouteName =
  | 'login' | 'dashboard' | 'institutions' | 'institution-detail' | 'institution-entities'
  | 'institution-admins' | 'institution-approval'
  | 'children' | 'stats' | 'notices' | 'notice-write' | 'notice-detail' | 'faq' | 'cs' | 'cs-detail'
  | 'sms-settings' | 'security' | 'content' | 'versions' | 'data' | 'mypage'
  | 'therapists' | 'doctors'

type Route =
  | { name: 'login' }
  | { name: 'dashboard' }
  | { name: 'institutions' }
  | { name: 'institution-detail'; id: string }
  | { name: 'institution-approval'; id: string }
  | { name: 'institution-entities' }
  | { name: 'institution-admins' }
  | { name: 'children' }
  | { name: 'stats' }
  | { name: 'notices' }
  | { name: 'notice-write' }
  | { name: 'notice-detail'; id: string }
  | { name: 'faq' }
  | { name: 'cs' }
  | { name: 'cs-detail'; id: string }
  | { name: 'sms-settings' }
  | { name: 'security' }
  | { name: 'content' }
  | { name: 'versions' }
  | { name: 'data' }
  | { name: 'mypage' }
  | { name: 'therapists' }
  | { name: 'doctors' }

type RouterValue = { route: Route; go: (r: Route) => void; navKey: number }

const RouterContext = createContext<RouterValue | null>(null)

function parseHash(hash: string): Route {
  if (hash.startsWith('#/institution-approval/')) return { name: 'institution-approval', id: hash.split('#/institution-approval/')[1] }
  if (hash.startsWith('#/institutions/')) return { name: 'institution-detail', id: hash.split('#/institutions/')[1] }
  if (hash.startsWith('#/institution-entities')) return { name: 'institution-entities' }
  if (hash.startsWith('#/institution-admins')) return { name: 'institution-admins' }
  if (hash.startsWith('#/institutions')) return { name: 'institutions' }
  if (hash.startsWith('#/notice-write'))  return { name: 'notice-write' }
  if (hash.startsWith('#/notice-detail/')) return { name: 'notice-detail', id: hash.split('#/notice-detail/')[1] }
  if (hash.startsWith('#/cs-detail/')) return { name: 'cs-detail', id: hash.split('#/cs-detail/')[1] }
  if (hash.startsWith('#/children'))     return { name: 'children' }
  if (hash.startsWith('#/stats'))        return { name: 'stats' }
  if (hash.startsWith('#/notices'))      return { name: 'notices' }
  if (hash.startsWith('#/faq'))          return { name: 'faq' }
  if (hash.startsWith('#/cs'))            return { name: 'cs' }
  if (hash.startsWith('#/sms-settings')) return { name: 'sms-settings' }
  if (hash.startsWith('#/security'))     return { name: 'security' }
  if (hash.startsWith('#/content'))      return { name: 'content' }
  if (hash.startsWith('#/versions'))     return { name: 'versions' }
  if (hash.startsWith('#/doctors'))       return { name: 'doctors' }
  if (hash.startsWith('#/therapists'))    return { name: 'therapists' }
  if (hash.startsWith('#/data'))         return { name: 'data' }
  if (hash.startsWith('#/mypage'))       return { name: 'mypage' }
  if (hash.startsWith('#/dashboard'))    return { name: 'dashboard' }
  if (hash.startsWith('#/login'))        return { name: 'login' }
  return { name: 'login' }
}

function toHash(r: Route): string {
  if (r.name === 'institution-approval') return `#/institution-approval/${r.id}`
  if (r.name === 'institution-detail') return `#/institutions/${r.id}`
  if (r.name === 'institution-entities') return '#/institution-entities'
  if (r.name === 'institution-admins') return '#/institution-admins'
  if (r.name === 'institutions') return '#/institutions'
  if (r.name === 'notice-write')  return '#/notice-write'
  if (r.name === 'notice-detail') return `#/notice-detail/${r.id}`
  if (r.name === 'cs-detail') return `#/cs-detail/${r.id}`
  if (r.name === 'children')     return '#/children'
  if (r.name === 'stats')        return '#/stats'
  if (r.name === 'notices')      return '#/notices'
  if (r.name === 'faq')          return '#/faq'
  if (r.name === 'cs')            return '#/cs'
  if (r.name === 'sms-settings') return '#/sms-settings'
  if (r.name === 'security')     return '#/security'
  if (r.name === 'content')      return '#/content'
  if (r.name === 'versions')     return '#/versions'
  if (r.name === 'doctors')       return '#/doctors'
  if (r.name === 'therapists')    return '#/therapists'
  if (r.name === 'data')         return '#/data'
  if (r.name === 'mypage')       return '#/mypage'
  if (r.name === 'dashboard')    return '#/dashboard'
  return '#/login'
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  const [navKey, setNavKey] = useState(0)
  useEffect(() => {
    const fn = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  const go = (next: Route) => { setRoute(next); setNavKey(k => k + 1); window.location.hash = toHash(next) }
  return <RouterContext.Provider value={{ route, go, navKey }}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
