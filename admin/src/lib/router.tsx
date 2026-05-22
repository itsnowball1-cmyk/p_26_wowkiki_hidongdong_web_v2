import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type RouteName =
  | 'login' | 'dashboard' | 'institutions' | 'institution-detail'
  | 'children' | 'stats' | 'notices' | 'security'
  | 'content' | 'versions' | 'data' | 'mypage'

type Route =
  | { name: 'login' }
  | { name: 'dashboard' }
  | { name: 'institutions' }
  | { name: 'institution-detail'; id: string }
  | { name: 'children' }
  | { name: 'stats' }
  | { name: 'notices' }
  | { name: 'security' }
  | { name: 'content' }
  | { name: 'versions' }
  | { name: 'data' }
  | { name: 'mypage' }

type RouterValue = { route: Route; go: (r: Route) => void }

const RouterContext = createContext<RouterValue | null>(null)

function parseHash(hash: string): Route {
  if (hash.startsWith('#/institutions/')) return { name: 'institution-detail', id: hash.split('#/institutions/')[1] }
  if (hash.startsWith('#/institutions')) return { name: 'institutions' }
  if (hash.startsWith('#/children'))     return { name: 'children' }
  if (hash.startsWith('#/stats'))        return { name: 'stats' }
  if (hash.startsWith('#/notices'))      return { name: 'notices' }
  if (hash.startsWith('#/security'))     return { name: 'security' }
  if (hash.startsWith('#/content'))      return { name: 'content' }
  if (hash.startsWith('#/versions'))     return { name: 'versions' }
  if (hash.startsWith('#/data'))         return { name: 'data' }
  if (hash.startsWith('#/mypage'))       return { name: 'mypage' }
  if (hash.startsWith('#/dashboard'))    return { name: 'dashboard' }
  if (hash.startsWith('#/login'))        return { name: 'login' }
  return { name: 'login' }
}

function toHash(r: Route): string {
  if (r.name === 'institution-detail') return `#/institutions/${r.id}`
  if (r.name === 'institutions') return '#/institutions'
  if (r.name === 'children')     return '#/children'
  if (r.name === 'stats')        return '#/stats'
  if (r.name === 'notices')      return '#/notices'
  if (r.name === 'security')     return '#/security'
  if (r.name === 'content')      return '#/content'
  if (r.name === 'versions')     return '#/versions'
  if (r.name === 'data')         return '#/data'
  if (r.name === 'mypage')       return '#/mypage'
  if (r.name === 'dashboard')    return '#/dashboard'
  return '#/login'
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const fn = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  const go = (next: Route) => { setRoute(next); window.location.hash = toHash(next) }
  return <RouterContext.Provider value={{ route, go }}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
