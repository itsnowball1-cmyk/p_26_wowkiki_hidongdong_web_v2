import { Fragment, useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { api, type CustomDetailDto } from '../lib/api'

type Props = { id: number }
type Section = 'candidate' | 'custom'

const DEFAULT_WORDS = [
  '고릴라', '금반지', '굼뱅이', '군만두', '고구마맛탕', '곰팡이', '가로', '고모부',
  '거북이', '강아지', '고양이', '구급차', '국자', '귀', '까치', '꽃',
  '김밥', '김치', '꼬리', '고래', '곰', '과자', '구두', '글씨',
  '가위', '가족', '가지', '거미', '건전지'
]

export default function ChildCustomDetail({ id }: Props) {
  const [detail, setDetail] = useState<CustomDetailDto | null>(null)
  const [coreWord, setCoreWord] = useState<string | null>(null)
  const [trainingList, setTrainingList] = useState<string[]>([])
  const [candidateList, setCandidateList] = useState<string[]>([])
  const [customWords, setCustomWords] = useState<string[]>([])
  const [addInput, setAddInput] = useState('')
  const [extracted, setExtracted] = useState(false)
  const [gameCount, setGameCount] = useState(10)
  const [filterOptions, setFilterOptions] = useState<Record<string, boolean>>({
    properAge: true, canRead: true, wordLength: false,
    removeClosed: true, removeNonNoun: false, ageAcquired: true, removeMispronounced: true
  })

  // training DnD
  const [trainDragIdx, setTrainDragIdx] = useState<number | null>(null)
  const [trainDropGap, setTrainDropGap] = useState<number | null>(null)
  const trainDroppedRef = useRef(false)
  // always-current ref for dragState — avoids stale closure in drag event handlers
  const dragStateRef = useRef<{ section: Section; idx: number } | null>(null)
  // tracks which words were ever added as "custom" so bumped training words go to the right section
  const customOriginSet = useRef<Set<string>>(new Set())

  // candidate/custom swap & DnD
  // swapSource includes 'training' so cross-section swaps are possible
  const [swapSource, setSwapSource] = useState<{ section: 'training' | 'core' | Section; idx: number } | null>(null)
  const [dragState, setDragState] = useState<{ section: Section; idx: number } | null>(null)
  const [dropGap, setDropGap] = useState<{ section: Section; gap: number } | null>(null)
  // duplicate flash: word names that should glow to indicate they already exist
  const [flashWords, setFlashWords] = useState<string[]>([])

  useEffect(() => {
    api.customDetail(id).then(setDetail).catch(() => {})
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSwapSource(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // keep ref in sync with state so drag event handlers always see current value
  dragStateRef.current = dragState

  const tLen = trainingList.length
  const ghostCount = Math.max(0, gameCount - tLen)

  const handleExtract = () => {
    const words = [...DEFAULT_WORDS]
    setCoreWord(words[0] ?? null)
    setTrainingList(words.slice(1, 1 + gameCount))
    setCandidateList(words.slice(1 + gameCount))
    setCustomWords([])
    customOriginSet.current.clear()
    setAddInput('')
    setSwapSource(null)
    setExtracted(true)
  }

  // ── training DnD handlers ──────────────────────────────────────────────────
  const handleTrainDragStart = (e: React.DragEvent, i: number) => {
    e.dataTransfer.effectAllowed = 'move'
    setTrainDragIdx(i)
    setSwapSource(null)
  }
  const handleTrainChipDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const gap = e.clientX < rect.left + rect.width / 2 ? i : i + 1
    if (trainDropGap !== gap) setTrainDropGap(gap)
  }
  const handleTrainContainerDrop = (e: React.DragEvent) => {
    e.preventDefault()
    trainDroppedRef.current = true

    // candidate or custom → training: drag and drop into training zone
    if (dragState?.section === 'candidate' || dragState?.section === 'custom') {
      const fromCustom = dragState.section === 'custom'
      const sourceList = fromCustom ? customWords : candidateList
      const word = sourceList[dragState.idx]
      if (word !== undefined) {
        const insertAt = Math.max(0, Math.min(tLen, trainDropGap ?? tLen))
        const newTraining = [...trainingList]
        newTraining.splice(insertAt, 0, word)
        let newSource = sourceList.filter((_, k) => k !== dragState.idx)
        if (newTraining.length > gameCount) {
          const [bumped] = newTraining.splice(gameCount)
          const bumpedIsCustom = customOriginSet.current.has(bumped)
          if (bumpedIsCustom === fromCustom) {
            newSource = [bumped, ...newSource]
          } else if (bumpedIsCustom) {
            setCustomWords(prev => [bumped, ...prev])
          } else {
            setCandidateList(prev => [bumped, ...prev])
          }
        }
        setTrainingList(newTraining)
        if (fromCustom) setCustomWords(newSource)
        else setCandidateList(newSource)
      }
      setDragState(null); setDropGap(null)
      setTrainDragIdx(null); setTrainDropGap(null)
      return
    }

    // intra-training reorder
    if (trainDragIdx === null || trainDropGap === null ||
        trainDropGap === trainDragIdx || trainDropGap === trainDragIdx + 1) {
      setTrainDragIdx(null); setTrainDropGap(null); return
    }
    setTrainingList(prev => {
      const next = [...prev]
      const [moved] = next.splice(trainDragIdx, 1)
      const at = trainDropGap > trainDragIdx ? trainDropGap - 1 : trainDropGap
      next.splice(Math.max(0, Math.min(next.length, at)), 0, moved)
      return next
    })
    setTrainDragIdx(null); setTrainDropGap(null)
  }
  const handleTrainRemoveDrop = (e: React.DragEvent) => {
    e.preventDefault()
    trainDroppedRef.current = true
    if (trainDragIdx !== null) removeFromTraining(trainDragIdx)
    setTrainDragIdx(null); setTrainDropGap(null)
  }
  const handleTrainDragEnd = () => {
    trainDroppedRef.current = false
    setTrainDragIdx(null); setTrainDropGap(null)
  }
  const removeFromTraining = (i: number) => {
    const word = trainingList[i]
    setTrainingList(prev => prev.filter((_, idx) => idx !== i))
    if (word && customOriginSet.current.has(word)) {
      setCustomWords(prev => [...prev, word])
    }
  }

  // ── training click-swap ────────────────────────────────────────────────────
  const handleTrainChipClick = (i: number) => {
    if (swapSource === null) {
      setSwapSource({ section: 'training', idx: i })
    } else if (swapSource.section === 'training' && swapSource.idx === i) {
      setSwapSource(null)
    } else if (swapSource.section === 'training') {
      // swap within training
      setTrainingList(prev => {
        const next = [...prev]
        ;[next[swapSource.idx], next[i]] = [next[i], next[swapSource.idx]]
        return next
      })
      setSwapSource(null)
    } else if (swapSource.section === 'candidate') {
      // candidate ↔ training swap
      const cWord = candidateList[swapSource.idx]
      const tWord = trainingList[i]
      if (cWord !== undefined && tWord !== undefined) {
        setCandidateList(prev => { const n = [...prev]; n[swapSource.idx] = tWord; return n })
        setTrainingList(prev => { const n = [...prev]; n[i] = cWord; return n })
      }
      setSwapSource(null)
    } else {
      // custom ↔ training swap
      const cuWord = customWords[swapSource.idx]
      const tWord = trainingList[i]
      if (cuWord !== undefined && tWord !== undefined) {
        setCustomWords(prev => { const n = [...prev]; n[swapSource.idx] = tWord; return n })
        setTrainingList(prev => { const n = [...prev]; n[i] = cuWord; return n })
      }
      setSwapSource(null)
    }
  }

  // ── add-word handler (duplicate detection) ─────────────────────────────────
  const handleAddWords = () => {
    const words = addInput.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return

    const existing = new Set([
      ...(coreWord ? [coreWord] : []),
      ...trainingList,
      ...candidateList,
      ...customWords,
    ])

    const dupes = words.filter(w => existing.has(w))
    const fresh = words.filter(w => !existing.has(w))

    if (dupes.length > 0) {
      setFlashWords(dupes)
      setTimeout(() => setFlashWords([]), 1400)
    }
    if (fresh.length > 0) {
      fresh.forEach(w => customOriginSet.current.add(w))
      setCustomWords(prev => [...prev, ...fresh])
    }
    setAddInput('')
  }

  const removeCustomWord = (i: number) => {
    setCustomWords(prev => prev.filter((_, idx) => idx !== i))
    setSwapSource(null)
  }

  // ── core word click-to-swap ────────────────────────────────────────────────
  const handleCoreWordClick = () => {
    if (!coreWord) return
    if (swapSource === null) {
      setSwapSource({ section: 'core', idx: 0 })
      return
    }
    if (swapSource.section === 'core') { setSwapSource(null); return }

    const section = swapSource.section === 'candidate' || swapSource.section === 'custom'
      ? swapSource.section : null
    if (!section) { setSwapSource(null); return }

    const srcList = section === 'candidate' ? candidateList : customWords
    const selectedWord = srcList[swapSource.idx]
    if (selectedWord === undefined) { setSwapSource(null); return }

    const oldCore = coreWord
    const oldCoreIsCustom = customOriginSet.current.has(oldCore)
    setCoreWord(selectedWord)

    if (section === 'candidate') {
      if (oldCoreIsCustom) {
        setCandidateList(prev => prev.filter((_, k) => k !== swapSource.idx))
        setCustomWords(prev => [...prev, oldCore])
      } else {
        setCandidateList(prev => { const n = [...prev]; n[swapSource.idx] = oldCore; return n })
      }
    } else {
      if (oldCoreIsCustom) {
        setCustomWords(prev => { const n = [...prev]; n[swapSource.idx] = oldCore; return n })
      } else {
        setCustomWords(prev => prev.filter((_, k) => k !== swapSource.idx))
        setCandidateList(prev => [...prev, oldCore])
      }
    }
    setSwapSource(null)
  }

  // ── section (candidate / custom) click-to-swap ─────────────────────────────
  const handleSectionChipClick = (section: Section, idx: number) => {
    if (swapSource === null) {
      setSwapSource({ section, idx })
    } else if (swapSource.section === 'core') {
      // core selected first → clicking section chip completes the swap
      const oldCore = coreWord!
      const sWord = section === 'candidate' ? candidateList[idx] : customWords[idx]
      if (!oldCore || sWord === undefined) { setSwapSource(null); return }
      const oldCoreIsCustom = customOriginSet.current.has(oldCore)
      setCoreWord(sWord)
      if (section === 'candidate') {
        if (oldCoreIsCustom) {
          setCandidateList(prev => prev.filter((_, k) => k !== idx))
          setCustomWords(prev => [...prev, oldCore])
        } else {
          setCandidateList(prev => { const n = [...prev]; n[idx] = oldCore; return n })
        }
      } else {
        if (oldCoreIsCustom) {
          setCustomWords(prev => { const n = [...prev]; n[idx] = oldCore; return n })
        } else {
          setCustomWords(prev => prev.filter((_, k) => k !== idx))
          setCandidateList(prev => [...prev, oldCore])
        }
      }
      setSwapSource(null)
    } else if (swapSource.section === 'training') {
      // training ↔ candidate/custom swap
      const tWord = trainingList[swapSource.idx]
      const sWord = section === 'candidate' ? candidateList[idx] : customWords[idx]
      if (tWord !== undefined && sWord !== undefined) {
        setTrainingList(prev => { const n = [...prev]; n[swapSource.idx] = sWord; return n })
        if (section === 'candidate') setCandidateList(prev => { const n = [...prev]; n[idx] = tWord; return n })
        else setCustomWords(prev => { const n = [...prev]; n[idx] = tWord; return n })
      }
      setSwapSource(null)
    } else if (swapSource.section === section && swapSource.idx === idx) {
      setSwapSource(null)
    } else if (swapSource.section === section) {
      // swap within same section
      const setter = section === 'candidate' ? setCandidateList : setCustomWords
      setter(prev => {
        const next = [...prev]
        ;[next[swapSource.idx], next[idx]] = [next[idx], next[swapSource.idx]]
        return next
      })
      setSwapSource(null)
    } else {
      // different sections (candidate↔custom not allowed) — switch source
      setSwapSource({ section, idx })
    }
  }

  // ── section DnD (same-section only) ───────────────────────────────────────
  const handleSectionDragStart = (e: React.DragEvent, section: Section, idx: number) => {
    e.dataTransfer.effectAllowed = 'move'
    dragStateRef.current = { section, idx }  // sync ref immediately (before re-render)
    setDragState({ section, idx })
    setSwapSource(null)
  }
  const handleSectionDragOver = (e: React.DragEvent, section: Section, idx: number) => {
    e.preventDefault()
    if (dragState?.section !== section) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const gap = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1
    if (dropGap?.section !== section || dropGap.gap !== gap) setDropGap({ section, gap })
  }
  const handleSectionDrop = (e: React.DragEvent, section: Section) => {
    e.preventDefault()
    if (!dragState || dragState.section !== section || !dropGap || dropGap.section !== section) {
      setDragState(null); setDropGap(null); return
    }
    const { idx: src } = dragState
    const { gap: dst } = dropGap
    if (dst === src || dst === src + 1) { setDragState(null); setDropGap(null); return }
    const setter = section === 'candidate' ? setCandidateList : setCustomWords
    setter(prev => {
      const next = [...prev]
      const [moved] = next.splice(src, 1)
      const at = dst > src ? dst - 1 : dst
      next.splice(Math.max(0, Math.min(next.length, at)), 0, moved)
      return next
    })
    setDragState(null); setDropGap(null)
  }
  const resetSectionDrag = () => { setDragState(null); setDropGap(null); setTrainDropGap(null) }

  // ── section chip renderer ──────────────────────────────────────────────────
  const renderSectionChip = (
    word: string,
    section: Section,
    idx: number,
    onRemove?: () => void
  ) => {
    const isSwapSrc = swapSource?.section === section && swapSource.idx === idx
    const isDragging = dragState?.section === section && dragState.idx === idx
    const isFlashing = flashWords.includes(word)
    const showGapBefore =
      dropGap?.section === section && dropGap.gap === idx &&
      dragState?.section === section && dragState.idx !== idx && dragState.idx !== idx - 1

    return (
      <div key={`${section}-${idx}-${word}`} className="relative inline-flex items-center">
        {showGapBefore && (
          <span className="absolute left-[-5px] top-0 bottom-0 w-[2px] bg-[#005744] rounded-full z-10 pointer-events-none" />
        )}
        <div
          draggable
          onDragStart={(e) => handleSectionDragStart(e, section, idx)}
          onDragOver={(e) => handleSectionDragOver(e, section, idx)}
          onDrop={(e) => handleSectionDrop(e, section)}
          onDragEnd={resetSectionDrag}
          onClick={() => handleSectionChipClick(section, idx)}
          title={swapSource?.section === section && swapSource.idx !== idx ? '클릭하여 교체' : undefined}
          className={[
            'inline-flex items-center h-8 rounded-[10px] text-[13px] select-none transition-all duration-100',
            onRemove ? 'pl-3 pr-1.5 gap-1' : 'px-3',
            swapSource?.section === section ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
            isDragging ? 'opacity-30 scale-95' : '',
            isFlashing ? 'ring-2 ring-amber-400 ring-offset-1 shadow-[0_0_10px_rgba(245,158,11,0.55)] animate-pulse' : '',
            isSwapSrc ? 'ring-2 ring-[#F59E0B] ring-offset-1' : '',
            'bg-[#EAEAEA] text-[#555555] border border-transparent hover:border-[#BEBEBE]',
          ].filter(Boolean).join(' ')}
        >
          <span>{word}</span>
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/10 shrink-0"
              aria-label={`${word} 제거`}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M1 1l6 6M7 1L1 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  // trailing DnD gap indicator after last chip in a section
  const sectionTrailingGap = (section: Section, afterLen: number) =>
    dropGap?.section === section && dropGap.gap === afterLen &&
    dragState?.section === section && dragState.idx !== afterLen - 1 ? (
      <span key={`${section}-trail`} className="inline-flex items-center h-8 w-[2px]">
        <span className="w-[2px] h-8 bg-[#005744] rounded-full" />
      </span>
    ) : null

  const coreIsFlashing = coreWord !== null && flashWords.includes(coreWord)

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-ink-900">아동 정보</h2>
            <LargeOutlineButton onClick={() => alert('임시저장함을 엽니다.')}>임시저장함</LargeOutlineButton>
          </div>

          {/* Row 1: Info card + Learning status */}
          <div className="grid grid-cols-1 xl:grid-cols-[315px_1fr] gap-5">
            <div className="bg-surface-card border border-[#ADADAD] rounded-[5px] overflow-hidden text-[14px]">
              <div className="px-5 py-3 flex items-center gap-3 min-h-[44px]">
                <span className="font-semibold text-ink-900">
                  {detail?.name ? `${detail.name}(${detail.identifier ?? ''})` : (detail?.identifier ?? '-')}
                </span>
                {detail?.age_label && (<><div className="w-px h-4 bg-line shrink-0" /><span className="text-ink-700">{detail.age_label}</span></>)}
                {detail?.gender && (<><div className="w-px h-4 bg-line shrink-0" /><span className="text-ink-700">{detail.gender}</span></>)}
              </div>
              <div className="border-t border-line" />
              <div className="px-5 py-3 flex items-center gap-4 min-h-[44px]">
                <span className="text-[13px] font-medium text-ink-700 shrink-0 w-[90px]">담당치료사</span>
                <span className="text-ink-900">{detail?.therapist_name ?? '-'}</span>
              </div>
              <div className="border-t border-line" />
              <div className="px-5 py-3 flex items-center gap-4 min-h-[44px]">
                <span className="text-[13px] font-medium text-ink-700 shrink-0 w-[90px]">치료 방문 일정</span>
                <div className="flex items-center gap-2">
                  {detail?.schedule && detail.schedule.length > 0 ? (
                    <><span className="text-ink-900">매주</span>
                    {detail.schedule.map((d) => (
                      <span key={d} className="inline-grid place-items-center w-[23px] h-[20px] rounded-[3px] bg-[#57987E] text-white text-[12px]">{d}</span>
                    ))}</>
                  ) : <span className="text-ink-400">-</span>}
                </div>
              </div>
            </div>

            <div className="bg-surface-card border border-[#DEDEDE] rounded-[10px] px-6 py-5 space-y-3 min-h-[137px]">
              <StatusRow label="현재 학습 내용">
                {detail?.current ? (
                  <>
                    <span className="text-[#FF6060] font-medium">{detail.current.sound}</span>
                    {(detail.current.by || detail.current.at) && (
                      <span className="text-ink-500 text-[13px] ml-2">/ {[detail.current.by, detail.current.at].filter(Boolean).join(' ')}</span>
                    )}
                  </>
                ) : <span className="text-[#AAAAAA]">학습 기록이 없습니다.</span>}
              </StatusRow>
              <StatusRow label="예약된 학습 내용">
                {detail?.reserved && typeof detail.reserved === 'object' && 'sound' in detail.reserved
                  ? <span className="text-[#FF6060] font-medium">{(detail.reserved as { sound: string }).sound}</span>
                  : <span className="text-[#AAAAAA]">예약된 정보가 없습니다.</span>}
              </StatusRow>
            </div>
          </div>

          {/* 진단 리포트 */}
          <section>
            <h3 className="text-[18px] font-semibold text-ink-900 mb-2">진단 리포트</h3>
            <div className="bg-surface-card border border-line rounded-[10px] overflow-hidden relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#57987E]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }} />
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-line-soft border-b border-line">
                    <th className="h-[37px] px-6 text-left font-medium text-ink-700 w-[33%]">오조음소</th>
                    <th className="h-[37px] px-6 text-left font-medium text-ink-700 w-[33%]">위치</th>
                    <th className="h-[37px] px-6 text-left font-medium text-ink-700">종류</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.diagnosis_rows ?? []).length === 0 && (
                    <tr><td colSpan={3} className="h-[47px] px-6 text-ink-400 text-[13px]">진단 데이터 없음</td></tr>
                  )}
                  {(detail?.diagnosis_rows ?? []).map(({ pos, phoneme, type }, i) => (
                    <tr key={i} className="border-b border-line last:border-b-0">
                      <td className="h-[47px] px-6 text-ink-900">{phoneme}</td>
                      <td className="h-[47px] px-6 text-ink-900">{pos}</td>
                      <td className="h-[47px] px-6">
                        <span className={`text-[12px] px-2 py-0.5 rounded font-medium ${type === 'CHANGE' ? 'bg-tag-blue text-ink-700' : 'bg-tag-pink text-ink-700'}`}>{type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 치료 단어 설정 */}
          <section className="space-y-5">
            <h3 className="text-[18px] font-bold text-ink-900">치료 단어 설정</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <TargetArticulationPanel />
              <WordFilterPanel options={filterOptions} setOptions={setFilterOptions} />
            </div>

            <div className="flex justify-center">
              <button type="button" onClick={handleExtract}
                className="w-[220px] h-[58px] rounded-[10px] bg-[#005744] text-white text-[18px] font-semibold hover:opacity-90 transition">
                단어 추출
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[20px] font-bold text-ink-900">추출된 단어 보기</h3>
              <GameTrainingCount value={gameCount} onChange={setGameCount} />
            </div>

            {/* ── Word panel ──────────────────────────────────────────────── */}
            {extracted ? (
              <div className="bg-white border border-[#DEDEDE] rounded-[10px] p-6 space-y-5">

                {/* 핵심단어 + add-word input */}
                <div className="flex items-start gap-4">
                  <div>
                    <p className="text-[15px] font-bold text-ink-900 mb-3">핵심단어</p>
                    {coreWord && (
                      <span
                        onClick={handleCoreWordClick}
                        title={swapSource && swapSource.section !== 'core' ? '클릭하여 교체' : undefined}
                        className={[
                          'inline-flex items-center h-9 px-4 rounded-[10px] bg-[#005744] text-white text-[14px] font-medium select-none transition-all cursor-pointer',
                          coreIsFlashing ? 'ring-2 ring-amber-400 ring-offset-1 shadow-[0_0_10px_rgba(245,158,11,0.55)] animate-pulse' : '',
                          swapSource?.section === 'core' ? 'ring-2 ring-[#F59E0B] ring-offset-1' : '',
                        ].filter(Boolean).join(' ')}>
                        {coreWord}
                      </span>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      value={addInput}
                      onChange={(e) => setAddInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddWords() }}
                      placeholder="리스트에 없는 단어를 직접 추가하세요."
                      className="h-9 w-[280px] px-3 border border-[#DEDEDE] rounded-[5px] text-[14px] focus:outline-none focus:border-[#005744] placeholder:text-ink-400"
                    />
                    <button type="button" onClick={handleAddWords}
                      className="h-9 px-5 rounded-[5px] border border-[#005744] text-[#005744] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition-colors shrink-0">
                      추가
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#EFEFEF]" />

                {/* 훈련단어 — horizontal scroll + ghost chips directly appended */}
                <div>
                  <p className="text-[15px] font-bold text-ink-900 mb-3">
                    훈련단어 <span className="text-[#005744]">{tLen}</span>
                    {tLen > 0 && ghostCount > 0 && (
                      <span className="text-[12px] font-normal text-ink-400 ml-2">({gameCount}회 중 {tLen}개 반복)</span>
                    )}
                    {swapSource?.section === 'training' && (
                      <span className="ml-2 text-[12px] font-normal text-[#F59E0B]">교체할 단어를 클릭하세요. (ESC 취소)</span>
                    )}
                  </p>

                  {/* horizontal scroll row — DnD drop target */}
                  <div
                    className="overflow-x-auto pb-2"
                    onDragOver={(e) => {
                      e.preventDefault()
                      const ds = dragStateRef.current
                      if (ds?.section === 'candidate' || ds?.section === 'custom') {
                        const chips = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-train-chip]')
                        let gap = chips.length
                        for (let ci = 0; ci < chips.length; ci++) {
                          const r = chips[ci].getBoundingClientRect()
                          if (e.clientX < r.left + r.width / 2) { gap = ci; break }
                          gap = ci + 1
                        }
                        setTrainDropGap(g => g === gap ? g : gap)
                      }
                    }}
                    onDrop={handleTrainContainerDrop}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setTrainDropGap(null) }}
                  >
                    <div className="flex items-center gap-2 min-w-max py-1 px-0.5">
                      {trainingList.map((word, i) => {
                        const isFlashing = flashWords.includes(word)
                        const isDragging = trainDragIdx === i
                        const isSwapSrc = swapSource?.section === 'training' && swapSource.idx === i
                        const inSwapMode = swapSource !== null
                        const isSectionDragToTrain = dragState?.section === 'candidate' || dragState?.section === 'custom'
                        const showGapBefore = trainDropGap === i && (trainDragIdx !== null || isSectionDragToTrain) && trainDragIdx !== i && trainDragIdx !== i - 1
                        return (
                          <Fragment key={`train-${i}-${word}`}>
                            {showGapBefore && (
                              <span className="inline-flex items-center h-8 w-[2px] shrink-0">
                                <span className="w-[2px] h-8 bg-[#005744] rounded-full" />
                              </span>
                            )}
                            <div
                              data-train-chip
                              draggable={!inSwapMode}
                              onDragStart={(e) => handleTrainDragStart(e, i)}
                              onDragOver={(e) => handleTrainChipDragOver(e, i)}
                              onDragEnd={handleTrainDragEnd}
                              onClick={() => handleTrainChipClick(i)}
                              title={inSwapMode && !isSwapSrc ? '클릭하여 교체' : undefined}
                              className={[
                                'inline-flex items-center h-8 pl-3 pr-1.5 gap-1 rounded-[10px] border-2 border-[#005744] bg-white text-[#005744] text-[13px] font-medium select-none transition-all duration-100 shrink-0',
                                inSwapMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                                isDragging ? 'opacity-30 scale-95' : '',
                                isSwapSrc ? 'ring-2 ring-[#F59E0B] ring-offset-1' : '',
                                isFlashing ? 'ring-2 ring-amber-400 ring-offset-1 shadow-[0_0_10px_rgba(245,158,11,0.55)] animate-pulse' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              <span className="whitespace-nowrap">{word}</span>
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); removeFromTraining(i) }}
                                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#005744]/15 shrink-0"
                                aria-label={`${word} 제거`}
                              >
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                  <path d="M1 1l6 6M7 1L1 7" />
                                </svg>
                              </button>
                            </div>
                            {/* > separator between chips */}
                            {i < tLen - 1 && (
                              <svg className="shrink-0 text-[#C0C0C0]" width="5" height="9" viewBox="0 0 5 9" fill="currentColor">
                                <polygon points="0,0 5,4.5 0,9" />
                              </svg>
                            )}
                          </Fragment>
                        )
                      })}
                      {/* trailing DnD gap after last real chip */}
                      {trainDropGap === tLen && (trainDragIdx !== null || dragState?.section === 'candidate' || dragState?.section === 'custom') && trainDragIdx !== tLen - 1 && (
                        <span className="inline-flex items-center h-8 w-[2px] shrink-0">
                          <span className="w-[2px] h-8 bg-[#005744] rounded-full" />
                        </span>
                      )}
                      {/* ghost repeat chips appended directly in the same scroll row */}
                      {tLen > 0 && ghostCount > 0 && Array.from({ length: ghostCount }, (_: unknown, i: number) => (
                        <Fragment key={`ghost-${i}`}>
                          <svg className="shrink-0 text-[#D0D0D0]" width="5" height="9" viewBox="0 0 5 9" fill="currentColor">
                            <polygon points="0,0 5,4.5 0,9" />
                          </svg>
                          <span className="inline-flex items-center justify-center h-8 px-3 rounded-[10px] text-[13px] bg-[#F0F0F0] text-ink-400 select-none shrink-0">
                            {trainingList[i % tLen]}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </div>

                  {/* removal drop zone — appears while dragging a training chip */}
                  {trainDragIdx !== null && (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleTrainRemoveDrop}
                      className="mt-2 h-10 rounded-[8px] border-2 border-dashed border-red-300 bg-red-50/60 flex items-center justify-center gap-1.5 text-[12px] text-red-400"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1,3 11,3" /><path d="M5,1h2M2,3l.8,7.2A1,1,0,001,11.2h7a1,1,0,001-.8L10,3" />
                      </svg>
                      여기에 놓으면 훈련 목록에서 제거됩니다
                    </div>
                  )}
                </div>

                {/* 직접 추가한 단어 — click-swap + DnD, no mix with candidates */}
                {customWords.length > 0 && (
                  <>
                    <div className="border-t border-[#EFEFEF]" />
                    <div>
                      <p className="text-[13px] font-semibold text-ink-700 mb-2">
                        직접 추가한 단어
                        {swapSource?.section === 'custom' && (
                          <span className="ml-2 text-[12px] font-normal text-[#F59E0B]">교체할 단어를 클릭하세요. (ESC 취소)</span>
                        )}
                      </p>
                      <div
                        className="flex flex-wrap gap-2"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleSectionDrop(e, 'custom')}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropGap(null) }}
                      >
                        {customWords.map((word, i) =>
                          renderSectionChip(word, 'custom', i, () => removeCustomWord(i))
                        )}
                        {sectionTrailingGap('custom', customWords.length)}
                      </div>
                    </div>
                  </>
                )}

                {/* 후보단어 — click-swap + DnD, no mix with custom */}
                {candidateList.length > 0 && (
                  <>
                    <div className="border-t border-[#EFEFEF]" />
                    <div>
                      <p className="text-[13px] font-semibold text-ink-500 mb-2">
                        후보단어 <span className="text-ink-400 font-normal">{candidateList.length}</span>
                        {(swapSource?.section === 'candidate' || swapSource?.section === 'training') && (
                          <span className="ml-2 text-[12px] font-normal text-[#F59E0B]">교체할 단어를 클릭하세요. (ESC 취소)</span>
                        )}
                      </p>
                      <div
                        className="flex flex-wrap gap-2"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleSectionDrop(e, 'candidate')}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropGap(null) }}
                      >
                        {candidateList.map((word, i) =>
                          renderSectionChip(word, 'candidate', i)
                        )}
                        {sectionTrailingGap('candidate', candidateList.length)}
                      </div>
                    </div>
                  </>
                )}

              </div>
            ) : (
              <div className="bg-white border border-[#DEDEDE] rounded-[10px] flex items-center justify-center min-h-[160px] text-[14px] text-ink-400">
                단어 추출 버튼을 눌러 단어를 불러오세요.
              </div>
            )}
          </section>

          {/* Bottom actions */}
          <div className="flex justify-center gap-4 pt-6 pb-12">
            {[
              { label: '초기화', onClick: () => { setCoreWord(null); setTrainingList([]); setCandidateList([]); setCustomWords([]); setAddInput(''); setExtracted(false); setSwapSource(null) } },
              { label: '임시저장', onClick: () => alert('임시저장되었습니다.') },
              { label: '예약하기', onClick: () => alert('예약되었습니다.') },
              { label: '적용', onClick: () => alert('적용되었습니다.') },
            ].map(({ label, onClick }) => (
              <button key={label} type="button" onClick={onClick}
                className="w-[220px] h-[58px] rounded-[10px] border border-[#005744] text-[#005744] text-[18px] font-semibold hover:bg-[#005744] hover:text-white transition">
                {label}
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

/* ---------------------------------- */
/* Status row                         */
/* ---------------------------------- */
function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center text-[14px]">
      <span className="text-ink-700 font-medium">{label}</span>
      <div className="text-ink-900">{children}</div>
    </div>
  )
}

/* ---------------------------------- */
/* 목표조음정의 panel                  */
/* ---------------------------------- */
const POSITION_OPTIONS = ['어두초성', '어중초성', '어중종성', '어말종성']
const CONSONANT_OPTIONS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const CORE_VOWEL_OPTIONS = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ', 'ㅐ', 'ㅔ']

type SortRule = { key: string; label: string; enabled: boolean; priority: number }

const INITIAL_SORT_RULES: SortRule[] = [
  { key: 'easyVowel', label: '쉬운 모음 결합', enabled: true, priority: 2 },
  { key: 'familiar', label: '친숙한 단어', enabled: true, priority: 1 },
  { key: 'ageMastered', label: '연령대 완전습득자음', enabled: true, priority: 3 }
]

function TargetArticulationPanel() {
  const [position, setPosition] = useState(POSITION_OPTIONS[0])
  const [consonant, setConsonant] = useState(CONSONANT_OPTIONS[0])
  const [coreVowel, setCoreVowel] = useState(CORE_VOWEL_OPTIONS[0])
  const [sortRules, setSortRules] = useState<SortRule[]>(INITIAL_SORT_RULES)

  const toggleEnabled = (key: string) =>
    setSortRules(rules => rules.map(r => r.key === key ? { ...r, enabled: !r.enabled } : r))
  const setPriority = (key: string, value: number) =>
    setSortRules(rules => rules.map(r => r.key === key ? { ...r, priority: Math.max(1, value) } : r))

  return (
    <div className="bg-surface-card border border-line rounded-[10px] p-6 min-h-[475px]">
      <h3 className="text-[18px] font-extrabold text-ink-900 mb-6">목표조음정의</h3>
      <div className="space-y-4 mb-8">
        <FieldRow label="목표 위치"><Select value={position} onChange={setPosition} options={POSITION_OPTIONS} /></FieldRow>
        <FieldRow label="목표 조음"><Select value={consonant} onChange={setConsonant} options={CONSONANT_OPTIONS} /></FieldRow>
        <FieldRow label="핵심 1음절"><Select value={coreVowel} onChange={setCoreVowel} options={CORE_VOWEL_OPTIONS} /></FieldRow>
      </div>
      <div className="border-t border-line pt-5">
        <div className="grid grid-cols-[1fr_90px_90px] gap-3 pb-2 border-b border-line text-[13px] font-medium text-ink-700">
          <span>정렬순서</span><span className="text-center">적용여부</span><span className="text-center">우선순위</span>
        </div>
        <ul className="divide-y divide-line">
          {sortRules.map(rule => (
            <li key={rule.key} className="grid grid-cols-[1fr_90px_90px] gap-3 py-3 items-center">
              <span className="text-[14px] text-ink-900">{rule.label}</span>
              <div className="flex justify-center"><CheckboxBox checked={rule.enabled} onChange={() => toggleEnabled(rule.key)} /></div>
              <div className="flex justify-center">
                <input type="number" min={1} value={rule.priority}
                  onChange={e => setPriority(rule.key, Number(e.target.value) || 1)}
                  className="w-14 h-8 text-center border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 items-center">
      <span className="text-[14px] font-medium text-ink-900">{label}</span>
      <div className="max-w-[280px]">{children}</div>
    </div>
  )
}

function CheckboxBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onChange}
      className={`w-5 h-5 rounded-[3px] border grid place-items-center transition-colors ${checked ? 'bg-brand border-brand' : 'bg-white border-[#B2B2B2] hover:border-brand'}`}>
      {checked && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="white" strokeWidth="2">
          <path d="M1 5l3.5 3.5L11 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

/* ---------------------------------- */
/* 단어 필터 panel                     */
/* ---------------------------------- */
const AGE_ACQUIRED_OPTIONS = ['완전습득', '숙달', '관습적', '출현']
const WORD_LENGTH_OPTIONS = ['1', '2', '3', '4', '5']
const AGE_MIN_BOUND = 3
const AGE_MAX_BOUND = 10

type FilterState = {
  ageMin: number; ageMax: number; removeMispronounced: boolean
  ageAcquired: string; removeNonNoun: boolean; removeClosed: boolean
  lengthMin: string; lengthMax: string; canRead: '가능' | '불가'
}

function WordFilterPanel({ options, setOptions }: {
  options: Record<string, boolean>
  setOptions: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  const [filter, setFilter] = useState<FilterState>({
    ageMin: AGE_MIN_BOUND, ageMax: AGE_MAX_BOUND,
    removeMispronounced: options.removeMispronounced, ageAcquired: AGE_ACQUIRED_OPTIONS[0],
    removeNonNoun: options.removeNonNoun, removeClosed: options.removeClosed,
    lengthMin: '1', lengthMax: '5', canRead: '가능'
  })
  const setField = <K extends keyof FilterState>(k: K, v: FilterState[K]) => setFilter(p => ({ ...p, [k]: v }))
  const toggleBool = (k: 'removeMispronounced' | 'removeNonNoun' | 'removeClosed') => {
    setFilter(p => ({ ...p, [k]: !p[k] }))
    setOptions(p => ({ ...p, [k]: !p[k] }))
  }
  const clampAgeMin = (n: number) => Math.max(AGE_MIN_BOUND, Math.min(filter.ageMax, n))
  const clampAgeMax = (n: number) => Math.max(filter.ageMin, Math.min(AGE_MAX_BOUND, n))

  return (
    <div className="bg-surface-card border border-line rounded-[10px] p-6 min-h-[475px]">
      <h3 className="text-[18px] font-extrabold text-ink-900 mb-5">단어 필터</h3>
      <ul className="divide-y divide-line">
        <FilterRow label="단어 적정 나이">
          <div className="flex items-center gap-2">
            <NumberStepper value={filter.ageMin} onChange={n => setField('ageMin', clampAgeMin(n))} min={AGE_MIN_BOUND} max={AGE_MAX_BOUND} />
            <span className="text-ink-500">~</span>
            <NumberStepper value={filter.ageMax} onChange={n => setField('ageMax', clampAgeMax(n))} min={AGE_MIN_BOUND} max={AGE_MAX_BOUND} />
            <span className="text-[13px] text-ink-500 ml-1">세</span>
          </div>
        </FilterRow>
        <FilterRow label="목표 이외 오조음제거"><CheckboxBox checked={filter.removeMispronounced} onChange={() => toggleBool('removeMispronounced')} /></FilterRow>
        <FilterRow label="연령대 습득 자음">
          <div className="w-[140px]"><Select value={filter.ageAcquired} onChange={v => setField('ageAcquired', v)} options={AGE_ACQUIRED_OPTIONS} /></div>
        </FilterRow>
        <FilterRow label="명사 이외 제거"><CheckboxBox checked={filter.removeNonNoun} onChange={() => toggleBool('removeNonNoun')} /></FilterRow>
        <FilterRow label="폐쇄형 단어 제거"><CheckboxBox checked={filter.removeClosed} onChange={() => toggleBool('removeClosed')} /></FilterRow>
        <FilterRow label="단어 길이">
          <div className="flex items-center gap-2">
            <div className="w-[64px]">
              <Select value={filter.lengthMin} onChange={v => { const min = Number(v); const max = Math.max(min, Number(filter.lengthMax)); setFilter(p => ({ ...p, lengthMin: v, lengthMax: String(max) })) }} options={WORD_LENGTH_OPTIONS} />
            </div>
            <span className="text-ink-500">~</span>
            <div className="w-[64px]">
              <Select value={filter.lengthMax} onChange={v => { const max = Number(v); const min = Math.min(max, Number(filter.lengthMin)); setFilter(p => ({ ...p, lengthMax: v, lengthMin: String(min) })) }} options={WORD_LENGTH_OPTIONS} />
            </div>
          </div>
        </FilterRow>
        <FilterRow label="한글 읽기 가능"><Segmented value={filter.canRead} onChange={v => setField('canRead', v)} options={['가능', '불가'] as const} /></FilterRow>
      </ul>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-3 py-3 items-center min-h-[50px]">
      <span className="text-[14px] text-ink-900">{label}</span>
      <div className="flex justify-end">{children}</div>
    </li>
  )
}

function NumberStepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="inline-flex items-center border border-line rounded-[5px] overflow-hidden bg-white">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min}
        className="w-7 h-8 grid place-items-center text-ink-700 hover:bg-surface-active disabled:text-ink-300 disabled:hover:bg-transparent" aria-label="감소">−</button>
      <input type="number" value={value} min={min} max={max}
        onChange={e => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n))) }}
        className="w-10 h-8 text-center text-[14px] focus:outline-none border-x border-line" />
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max}
        className="w-7 h-8 grid place-items-center text-ink-700 hover:bg-surface-active disabled:text-ink-300 disabled:hover:bg-transparent" aria-label="증가">+</button>
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly T[] }) {
  return (
    <div className="inline-flex bg-line-soft p-0.5 rounded-[5px]">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`h-7 px-4 rounded-[3px] text-[13px] font-medium transition-colors ${opt === value ? 'bg-brand text-white' : 'text-ink-700 hover:text-ink-900'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------- */
/* 게임 훈련 횟수                      */
/* ---------------------------------- */
function GameTrainingCount({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[14px] font-medium text-ink-900">게임 훈련 횟수</span>
      <div className="inline-flex items-center border border-line rounded-[5px] overflow-hidden">
        <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className="w-8 h-9 grid place-items-center text-ink-700 hover:bg-surface-active">−</button>
        <input type="number" value={value} onChange={e => onChange(Math.max(1, Number(e.target.value) || 1))} className="w-12 h-9 text-center text-[14px] focus:outline-none border-x border-line" />
        <button type="button" onClick={() => onChange(value + 1)} className="w-8 h-9 grid place-items-center text-ink-700 hover:bg-surface-active">+</button>
      </div>
      <span className="text-[13px] text-ink-500">회</span>
    </div>
  )
}

/* ---------------------------------- */
/* Form primitives                    */
/* ---------------------------------- */
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-9 appearance-none border border-line rounded-[5px] bg-white text-[14px] focus:outline-none focus:border-brand">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
        <polygon points="0,0 10,0 5,6" />
      </svg>
    </div>
  )
}

function LargeOutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="h-9 px-5 rounded-[5px] border border-[#005744] text-[#005744] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition-colors">
      {children}
    </button>
  )
}
