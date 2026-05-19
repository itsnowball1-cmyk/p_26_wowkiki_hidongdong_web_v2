import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type FaqListItem } from '../lib/api'

const TABS = ['아동관리', '전체 내진 일정', '아동별 커스텀', '마이페이지', '기타']

export default function FaqList() {
  const { go } = useRouter()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState(TABS[0])
  const [tabItems, setTabItems] = useState<FaqListItem[]>([])
  const [allItems, setAllItems] = useState<FaqListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [inputValue, setInputValue] = useState('')
  const [confirmedSearch, setConfirmedSearch] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [searchResults, setSearchResults] = useState<FaqListItem[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  // 자동완성용 전체 목록 1회 로드
  useEffect(() => {
    api.faqList('', '').then(data => setAllItems(data.items)).catch(() => {})
  }, [])

  // 탭별 목록
  useEffect(() => {
    if (isSearchMode) return
    setLoading(true)
    api.faqList(activeTab, '')
      .then(data => setTabItems(data.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeTab, isSearchMode])

  // 검색 결과
  useEffect(() => {
    if (!isSearchMode || !confirmedSearch) return
    setLoading(true)
    api.faqList('', confirmedSearch)
      .then(data => setSearchResults(data.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isSearchMode, confirmedSearch])

  // 자동완성 필터링
  useEffect(() => {
    if (!inputValue.trim()) { setShowAutocomplete(false); return }
    setShowAutocomplete(true)
  }, [inputValue, allItems])

  const autocompleteItems = inputValue.trim()
    ? allItems.filter(item => item.BOARD_TITLE.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 8)
    : []

  const handleSearch = () => {
    if (!inputValue.trim()) return
    setConfirmedSearch(inputValue)
    setIsSearchMode(true)
    setShowAutocomplete(false)
  }

  const handleReset = () => {
    setIsSearchMode(false)
    setConfirmedSearch('')
    setInputValue('')
    setShowAutocomplete(false)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setIsSearchMode(false)
    setConfirmedSearch('')
    setInputValue('')
    setShowAutocomplete(false)
  }

  const displayItems = isSearchMode ? searchResults : tabItems

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">
          <h1 className="text-[22px] font-bold text-center mb-6">FAQ</h1>

          {/* 검색 */}
          <div className="relative mb-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                onFocus={() => inputValue.trim() && setShowAutocomplete(true)}
                onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
                placeholder="검색어를 입력하세요."
                className="w-full h-11 pl-4 pr-12 border border-line-input rounded-[5px] text-[15px] focus:outline-none focus:border-brand bg-white"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-brand transition-colors"
                aria-label="검색"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="6" />
                  <path d="m14 14 4 4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 자동완성 드롭다운 */}
            {showAutocomplete && autocompleteItems.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-0.5 bg-white border border-line rounded-[5px] shadow-md overflow-hidden">
                {autocompleteItems.map(item => (
                  <button
                    key={item.BOARD_KEY}
                    type="button"
                    onMouseDown={() => go({ name: 'faq-detail', id: item.BOARD_KEY })}
                    className="w-full px-4 py-2.5 text-left text-[14px] text-ink-700 hover:bg-surface-active border-b border-line last:border-0 transition-colors"
                  >
                    {item.BOARD_TITLE}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 검색 모드: 처음으로 돌아가기 */}
          {isSearchMode && (
            <button
              type="button"
              onClick={handleReset}
              className="mb-4 text-[14px] text-ink-500 hover:text-brand transition-colors flex items-center gap-1"
            >
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 1 1 5l4 4" />
              </svg>
              처음으로 돌아가기
            </button>
          )}

          {/* 카테고리 탭 (검색 모드 아닐 때) */}
          {!isSearchMode && (
            <div className="flex items-center gap-1 mb-4 border-b border-line">
              {TABS.map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`px-4 py-2.5 text-[14px] font-medium rounded-t transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-brand text-white'
                      : 'text-ink-500 hover:text-ink-800 hover:bg-surface-active'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* FAQ 목록 */}
          <div className="divide-y divide-line border border-line rounded-[5px] overflow-hidden bg-white">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[56px] px-4 flex items-center">
                <div className="h-4 rounded animate-pulse bg-line w-72" />
              </div>
            ))}
            {!loading && displayItems.length === 0 && (
              <div className="h-[80px] flex items-center justify-center text-ink-400 text-[14px]">
                {isSearchMode ? '검색 결과가 없습니다.' : '등록된 FAQ가 없습니다.'}
              </div>
            )}
            {!loading && displayItems.map(item => (
              <button
                key={item.BOARD_KEY}
                type="button"
                onClick={() => go({ name: 'faq-detail', id: item.BOARD_KEY })}
                className="w-full px-4 h-[56px] flex items-center justify-between hover:bg-surface-active transition-colors text-left group"
              >
                <span className="text-[15px] text-ink-700 group-hover:text-ink-900">
                  Q. {item.BOARD_TITLE}
                </span>
                <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-ink-300 shrink-0">
                  <path d="m1 1 6 5.5-6 5.5" />
                </svg>
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
