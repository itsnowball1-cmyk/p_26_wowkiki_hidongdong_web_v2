import { useRouter } from '../lib/router'

const TABS = [
  { label: '아동 정보',          name: 'admin-children' as const },
  { label: '아동 이력 조회/다운', name: 'admin-child-history' as const },
  { label: '아동 삭제 이력',      name: 'admin-deleted-children' as const },
]

export default function AdminChildTabs() {
  const { route, go } = useRouter()
  return (
    <div className="flex items-center bg-[#EAEAEA] h-[52px] mb-5 -mx-6 lg:-mx-10 px-6 lg:px-10">
      {TABS.map(tab => {
        const active = route.name === tab.name
        return (
          <button
            key={tab.name}
            type="button"
            onClick={() => go({ name: tab.name })}
            className={`h-[38px] flex items-center gap-[14px] px-4 rounded-[5px] transition-colors ${
              active ? 'bg-[#F1F1F1]' : 'hover:bg-[#F1F1F1]/60'
            }`}
          >
            <span className={`inline-block w-5 h-5 rounded-[3px] shrink-0 ${active ? 'bg-[#005744]' : 'bg-[#B5B5B5]'}`} aria-hidden />
            <span className={`text-[15px] font-medium ${active ? 'text-[#343A40]' : 'text-[#B5B5B5]'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
