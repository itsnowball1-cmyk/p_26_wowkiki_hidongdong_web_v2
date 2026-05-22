import { useEffect, useState } from 'react'

type CustomDetail = {
  target_position: string | null
  target_articulation: string | null
  core_syllable: string | null
  word_age: string | null
  age_consonant: string | null
  can_read: string | null
  word_length: string | null
  game_count: string | null
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }

export default function StatsCustomDetail({
  log,
  onBack,
}: {
  log: { log_idx: number; activity_dt: string; child_name_code: string; status: string }
  onBack: () => void
}) {
  const [detail, setDetail] = useState<CustomDetail | null>(null)

  useEffect(() => {
    fetch(`/api/admin/custom-detail?log_idx=${log.log_idx}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDetail(d) })
  }, [log.log_idx])

  return (
    <div>
      {/* 목록으로 돌아가기 */}
      <div className="flex justify-end mb-4">
        <button type="button" onClick={onBack} className="text-[12px] text-[#000000] hover:text-[#005744] transition">
          목록으로 돌아가기&gt;
        </button>
      </div>

      {/* 제목 */}
      <h2 className="text-[18px] font-medium text-[#000000] mb-3">커스텀 이력 상세</h2>

      {/* 기본 정보 strip */}
      <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
        <div className="grid grid-cols-3 bg-[#EAEAEA] border-b border-[#DEDEDE] px-6 h-[52px] items-center text-[15px] font-medium text-[#202020] text-center">
          <span>일시</span>
          <span>아동 이름(식별코드)</span>
          <span>상태</span>
        </div>
        <div className="grid grid-cols-3 bg-white px-6 h-[52px] items-center text-[15px] text-center">
          <span className="text-[#585858]">{log.activity_dt}</span>
          <span className="text-[#484848]">{log.child_name_code}</span>
          <span className="text-[#585858]">{log.status}</span>
        </div>
      </div>

      {/* 세 섹션 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 목표 조음 */}
        <div>
          <h3 className="text-[18px] font-medium text-[#000000] mb-2">목표 조음</h3>
          <InfoTable rows={[
            { label: '목표 위치',  value: detail?.target_position     ?? '-' },
            { label: '목표 조음',  value: detail?.target_articulation ?? '-' },
            { label: '핵심 1음절', value: detail?.core_syllable       ?? '-' },
          ]} />
        </div>

        {/* 단어필터 */}
        <div>
          <h3 className="text-[18px] font-medium text-[#000000] mb-2">단어필터</h3>
          <InfoTable rows={[
            { label: '단어 적정 나이',    value: detail?.word_age      ?? '-' },
            { label: '연령대 슥듭 자음',  value: detail?.age_consonant ?? '-' },
            { label: '한글읽기 가능',     value: detail?.can_read      ?? '-' },
            { label: '단어길이',          value: detail?.word_length   ?? '-' },
          ]} />
        </div>

        {/* 게임 훈련 횟수 */}
        <div>
          <h3 className="text-[18px] font-medium text-[#000000] mb-2">게임 훈련 횟수</h3>
          <InfoTable rows={[
            { label: '게임 훈련 횟수', value: detail?.game_count ?? '-' },
          ]} />
        </div>
      </div>
    </div>
  )
}

function InfoTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`grid grid-cols-[215px_1fr] h-[52px] items-center ${i < rows.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
        >
          <div className="bg-[#EAEAEA] h-full flex items-center px-4 text-[15px] font-medium text-[#202020] border-r border-[#DEDEDE]">
            {row.label}
          </div>
          <div className="bg-white h-full flex items-center px-4 text-[15px] text-[#585858]">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  )
}
