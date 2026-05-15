type Props = {
  current: 1 | 2 | 3
}

const STEPS = ['이용약관 및 가입 확인', '회원정보 입력', '가입완료'] as const

export default function Stepper({ current }: Props) {
  return (
    <div className="grid grid-cols-3 gap-0 items-start max-w-[940px] mx-auto">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const state = step < current ? 'done' : step === current ? 'active' : 'pending'
        const isLast = i === STEPS.length - 1
        return (
          <div key={label} className="relative flex flex-col items-center">
            <div className="relative w-full flex justify-center">
              <StepCircle state={state} />
              {!isLast && (
                <span
                  className={`absolute top-1/2 -translate-y-1/2 left-1/2 ml-3 h-px ${
                    state === 'done' ? 'bg-brand' : 'bg-line-dash'
                  }`}
                  style={{ width: 'calc(100% - 24px)' }}
                />
              )}
            </div>
            <div className="mt-3 text-[15px] font-medium text-ink-850">{label}</div>
          </div>
        )
      })}
    </div>
  )
}

function StepCircle({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <span className="relative z-10 w-6 h-6 rounded-full bg-brand grid place-items-center">
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="white" strokeWidth="2">
          <path d="M1 5l3.5 3.5L11 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="relative z-10 w-6 h-6 rounded-full border-2 border-brand bg-white grid place-items-center">
        <span className="w-[13px] h-[13px] rounded-full bg-brand" />
      </span>
    )
  }
  return (
    <span className="relative z-10 w-6 h-6 rounded-full bg-white grid place-items-center">
      <span className="w-[13px] h-[13px] rounded-full bg-line-dash" />
    </span>
  )
}
