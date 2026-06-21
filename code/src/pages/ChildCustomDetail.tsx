import { Fragment, useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { api, type CustomDetailDto } from '../lib/api'

type Props = { id: number }
type Section = 'candidate' | 'custom'

// 목표조음/필터 state — TrainingSetDto 형상에 맞춰 top-level 관리.
// 저장 시 그대로 PUT 페이로드가 됨.
type CustomState = {
  idx: number | null
  aim_joum: string; pos: string; coreword: string
  suit_age: number; growth_grade: number
  is_ojoum_del_yn: 'Y' | 'N'; is_only_noun_yn: 'Y' | 'N'; is_cvcword_del_yn: 'Y' | 'N'
  min_len: number; max_len: number
  can_read_yn: 'Y' | 'N'
  orderby_evowels_yn: 'Y' | 'N'; orderby_ewords_yn: 'Y' | 'N'
}
const DEFAULT_CUSTOM: CustomState = {
  idx: null, aim_joum: 'ㄱ', pos: '어두초성', coreword: '',
  suit_age: 5, growth_grade: 1,
  is_ojoum_del_yn: 'N', is_only_noun_yn: 'Y', is_cvcword_del_yn: 'Y',
  min_len: 2, max_len: 3, can_read_yn: 'N',
  orderby_evowels_yn: 'N', orderby_ewords_yn: 'Y'
}

export default function ChildCustomDetail({ id }: Props) {
  const [detail, setDetail] = useState<CustomDetailDto | null>(null)
  const [custom, setCustom] = useState<CustomState>(DEFAULT_CUSTOM)
  const [coreWord, setCoreWord] = useState<string | null>(null)
  const [trainingList, setTrainingList] = useState<string[]>([])
  const [candidateList, setCandidateList] = useState<string[]>([])
  const [customWords, setCustomWords] = useState<string[]>([])
  const [addInput, setAddInput] = useState('')
  const [extracted, setExtracted] = useState(false)
  const [gameCount, setGameCount] = useState(10)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)

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
    api.customDetail(id).then(d => {
      setDetail(d)
      // 저장된 trainingset 이 있으면 그것으로 초기화 (client app 의 LoadTrainingSet 응답에 해당)
      if (d.trainingset) {
        const t = d.trainingset
        setCustom({
          idx: t.idx, aim_joum: t.aim_joum, pos: t.pos, coreword: t.coreword,
          suit_age: t.suit_age, growth_grade: t.growth_grade,
          is_ojoum_del_yn: (t.is_ojoum_del_yn as 'Y' | 'N') ?? 'N',
          is_only_noun_yn: (t.is_only_noun_yn as 'Y' | 'N') ?? 'Y',
          is_cvcword_del_yn: (t.is_cvcword_del_yn as 'Y' | 'N') ?? 'Y',
          min_len: t.min_len, max_len: t.max_len,
          can_read_yn: (t.can_read_yn as 'Y' | 'N') ?? 'N',
          orderby_evowels_yn: (t.orderby_evowels_yn as 'Y' | 'N') ?? 'N',
          orderby_ewords_yn: (t.orderby_ewords_yn as 'Y' | 'N') ?? 'Y'
        })
        setCoreWord(t.coreword || (t.tr_words[0] ?? null))
        // coreword 는 chip 으로 따로 표시되므로 tr_words 에서 제외하고 훈련 목록 + 후보로 분할
        const remaining = t.tr_words.filter(w => w !== t.coreword)
        const tcount = Math.min(gameCount, remaining.length)
        setTrainingList(remaining.slice(0, tcount))
        setCandidateList(remaining.slice(tcount))
        setCustomWords([])
        setExtracted(true)
      }
    }).catch(() => {})
    // gameCount 는 의도적으로 deps 제외 — 초기 로드 시점 값만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleExtract = async () => {
    if (extracting) return
    setExtracting(true)
    try {
      const r = await api.customExtract(id, {
        aim_joum: custom.aim_joum, pos: custom.pos,
        suit_age: custom.suit_age, growth_grade: custom.growth_grade,
        is_ojoum_del_yn: custom.is_ojoum_del_yn,
        is_only_noun_yn: custom.is_only_noun_yn,
        is_cvcword_del_yn: custom.is_cvcword_del_yn,
        min_len: custom.min_len, max_len: custom.max_len,
        orderby_ewords_yn: custom.orderby_ewords_yn
      })
      const words = r.tr_words
      setCustom(c => ({ ...c, coreword: r.coreword }))
      setCoreWord(r.coreword || words[0] || null)
      const after = words.filter(w => w !== r.coreword)
      setTrainingList(after.slice(0, gameCount))
      setCandidateList(after.slice(gameCount))
      setCustomWords([])
      customOriginSet.current.clear()
      setAddInput('')
      setSwapSource(null)
      setExtracted(true)
    } catch (e) {
      console.error(e); alert('단어 추출 실패')
    } finally {
      setExtracting(false)
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const tr_words = [
        ...(coreWord ? [coreWord] : []),
        ...trainingList,
        ...candidateList,
        ...customWords
      ]
      const r = await api.customSave(id, {
        idx: custom.idx ?? undefined,
        aim_joum: custom.aim_joum, pos: custom.pos, coreword: coreWord ?? custom.coreword,
        tr_words,
        suit_age: custom.suit_age, growth_grade: custom.growth_grade,
        is_ojoum_del_yn: custom.is_ojoum_del_yn,
        is_only_noun_yn: custom.is_only_noun_yn,
        is_cvcword_del_yn: custom.is_cvcword_del_yn,
        min_len: custom.min_len, max_len: custom.max_len,
        can_read_yn: custom.can_read_yn,
        orderby_evowels_yn: custom.orderby_evowels_yn,
        orderby_ewords_yn: custom.orderby_ewords_yn
      })
      setCustom(c => ({ ...c, idx: r.idx }))
      alert(r.action === 'insert' ? '새 trainingset 으로 저장되었습니다.' : '저장되었습니다.')
    } catch (e) {
      console.error(e); alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  // 취약한 발음 후보 클릭 → 목표조음 즉시 변경
  const applyWeakPhoneme = (phoneme: string, posLabel: string) => {
    setCustom(c => ({ ...c, aim_joum: phoneme, pos: posLabel }))
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
                <span className="text-ink-900">
                  {detail?.schedule && detail.schedule.length > 0
                    ? (nextScheduledDate(detail.schedule) ?? '-')
                    : '-'}
                </span>
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

            {/* 취약한 발음 후보 (최근 진단 기반) — 클릭하면 목표조음 자동 설정 */}
            {detail?.weak_phonemes && detail.weak_phonemes.length > 0 && (
              <div className="bg-surface-card border border-line rounded-[10px] p-5">
                <p className="text-[14px] font-semibold text-ink-900 mb-3">취약한 발음 후보</p>
                <div className="flex flex-wrap gap-2">
                  {detail.weak_phonemes.map((w, i) => {
                    const active = custom.aim_joum === w.phoneme && custom.pos === w.pos
                    return (
                      <button key={i} type="button" onClick={() => applyWeakPhoneme(w.phoneme, w.pos)}
                        className={[
                          'inline-flex items-center gap-2 h-9 px-3 rounded-[10px] border text-[13px] transition',
                          active
                            ? 'border-[#005744] bg-[#005744] text-white'
                            : 'border-line bg-white text-ink-900 hover:border-[#005744]'
                        ].join(' ')}>
                        <span className="font-bold">{w.phoneme}</span>
                        <span className="opacity-80">{w.category}</span>
                        <span className="opacity-60 text-[11px]">{w.pos}</span>
                        <span className="ml-1 text-[11px] opacity-60">×{w.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <TargetArticulationPanel
                value={{
                  aim_joum: custom.aim_joum, pos: custom.pos, coreword: custom.coreword,
                  orderby_evowels_yn: custom.orderby_evowels_yn, orderby_ewords_yn: custom.orderby_ewords_yn
                }}
                onChange={patch => setCustom(c => ({ ...c, ...patch }))} />
              <WordFilterPanel
                value={{
                  suit_age: custom.suit_age, growth_grade: custom.growth_grade,
                  is_ojoum_del_yn: custom.is_ojoum_del_yn, is_only_noun_yn: custom.is_only_noun_yn,
                  is_cvcword_del_yn: custom.is_cvcword_del_yn, min_len: custom.min_len, max_len: custom.max_len,
                  can_read_yn: custom.can_read_yn
                }}
                onChange={patch => setCustom(c => ({ ...c, ...patch }))} />
            </div>

            <div className="flex justify-center">
              <button type="button" onClick={handleExtract} disabled={extracting}
                className="w-[220px] h-[58px] rounded-[10px] bg-[#005744] text-white text-[18px] font-semibold hover:opacity-90 transition disabled:opacity-50">
                {extracting ? '추출 중…' : '단어 추출'}
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
            <button type="button"
              onClick={() => {
                setCustom(DEFAULT_CUSTOM); setCoreWord(null)
                setTrainingList([]); setCandidateList([]); setCustomWords([])
                setAddInput(''); setExtracted(false); setSwapSource(null)
                customOriginSet.current.clear()
              }}
              className="w-[220px] h-[58px] rounded-[10px] border border-[#005744] text-[#005744] text-[18px] font-semibold hover:bg-[#005744] hover:text-white transition">
              초기화
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="w-[220px] h-[58px] rounded-[10px] bg-[#005744] text-white text-[18px] font-semibold hover:opacity-90 transition disabled:opacity-50">
              {saving ? '저장 중…' : '저장'}
            </button>
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

function TargetArticulationPanel({ value, onChange }: {
  value: { aim_joum: string; pos: string; coreword: string; orderby_evowels_yn: 'Y' | 'N'; orderby_ewords_yn: 'Y' | 'N' }
  onChange: (patch: Partial<{ aim_joum: string; pos: string; coreword: string; orderby_evowels_yn: 'Y' | 'N'; orderby_ewords_yn: 'Y' | 'N' }>) => void
}) {
  // CONSONANT_OPTIONS 에 현재 값이 없으면 (예: 받침 자모) 임시로 끼워 표시
  const consonantOpts = CONSONANT_OPTIONS.includes(value.aim_joum) ? CONSONANT_OPTIONS : [value.aim_joum, ...CONSONANT_OPTIONS]
  const positionOpts  = POSITION_OPTIONS.includes(value.pos) ? POSITION_OPTIONS : [value.pos, ...POSITION_OPTIONS]
  return (
    <div className="bg-surface-card border border-line rounded-[10px] p-6 min-h-[475px]">
      <h3 className="text-[18px] font-extrabold text-ink-900 mb-6">목표조음정의</h3>
      <div className="space-y-4 mb-8">
        <FieldRow label="목표 위치"><Select value={value.pos} onChange={v => onChange({ pos: v })} options={positionOpts} /></FieldRow>
        <FieldRow label="목표 조음"><Select value={value.aim_joum} onChange={v => onChange({ aim_joum: v })} options={consonantOpts} /></FieldRow>
        <FieldRow label="핵심 단어">
          <input
            value={value.coreword}
            onChange={e => onChange({ coreword: e.target.value })}
            placeholder="대표 단어 (예: 다리)"
            className="w-full h-9 px-3 border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand"
          />
        </FieldRow>
      </div>
      <div className="border-t border-line pt-5">
        <p className="text-[13px] font-medium text-ink-700 mb-3">단어 정렬</p>
        <ul className="space-y-3 text-[14px]">
          <li className="flex items-center justify-between">
            <span>쉬운 모음 우선 정렬</span>
            <CheckboxBox checked={value.orderby_evowels_yn === 'Y'} onChange={() => onChange({ orderby_evowels_yn: value.orderby_evowels_yn === 'Y' ? 'N' : 'Y' })} />
          </li>
          <li className="flex items-center justify-between">
            <span>친숙한 단어(빈도) 우선 정렬</span>
            <CheckboxBox checked={value.orderby_ewords_yn === 'Y'} onChange={() => onChange({ orderby_ewords_yn: value.orderby_ewords_yn === 'Y' ? 'N' : 'Y' })} />
          </li>
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
const GROWTH_GRADE_OPTIONS = [
  { value: 1, label: '완전습득' },
  { value: 2, label: '숙달' },
  { value: 3, label: '관습적' },
  { value: 4, label: '출현' }
]
const WORD_LENGTH_OPTIONS = ['1', '2', '3', '4', '5']
const AGE_MIN_BOUND = 1
const AGE_MAX_BOUND = 10

type FilterValue = {
  suit_age: number; growth_grade: number
  is_ojoum_del_yn: 'Y' | 'N'; is_only_noun_yn: 'Y' | 'N'; is_cvcword_del_yn: 'Y' | 'N'
  min_len: number; max_len: number; can_read_yn: 'Y' | 'N'
}

function WordFilterPanel({ value, onChange }: {
  value: FilterValue
  onChange: (patch: Partial<FilterValue>) => void
}) {
  return (
    <div className="bg-surface-card border border-line rounded-[10px] p-6 min-h-[475px]">
      <h3 className="text-[18px] font-extrabold text-ink-900 mb-5">단어 필터</h3>
      <ul className="divide-y divide-line">
        <FilterRow label="단어 적정 나이">
          <div className="flex items-center gap-2">
            <NumberStepper value={value.suit_age}
              onChange={n => onChange({ suit_age: Math.max(AGE_MIN_BOUND, Math.min(AGE_MAX_BOUND, n)) })}
              min={AGE_MIN_BOUND} max={AGE_MAX_BOUND} />
            <span className="text-[13px] text-ink-500 ml-1">세</span>
          </div>
        </FilterRow>
        <FilterRow label="연령대 습득 자음">
          <div className="w-[140px]">
            <select value={value.growth_grade}
              onChange={e => onChange({ growth_grade: Number(e.target.value) })}
              className="w-full h-9 pl-3 pr-9 appearance-none border border-line rounded-[5px] bg-white text-[14px] focus:outline-none focus:border-brand">
              {GROWTH_GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </FilterRow>
        <FilterRow label="목표 이외 오조음 제거"><CheckboxBox checked={value.is_ojoum_del_yn === 'Y'} onChange={() => onChange({ is_ojoum_del_yn: value.is_ojoum_del_yn === 'Y' ? 'N' : 'Y' })} /></FilterRow>
        <FilterRow label="명사만 사용"><CheckboxBox checked={value.is_only_noun_yn === 'Y'} onChange={() => onChange({ is_only_noun_yn: value.is_only_noun_yn === 'Y' ? 'N' : 'Y' })} /></FilterRow>
        <FilterRow label="받침 있는 단어 제거"><CheckboxBox checked={value.is_cvcword_del_yn === 'Y'} onChange={() => onChange({ is_cvcword_del_yn: value.is_cvcword_del_yn === 'Y' ? 'N' : 'Y' })} /></FilterRow>
        <FilterRow label="단어 길이">
          <div className="flex items-center gap-2">
            <div className="w-[64px]">
              <Select value={String(value.min_len)}
                onChange={v => { const min = Number(v); const max = Math.max(min, value.max_len); onChange({ min_len: min, max_len: max }) }}
                options={WORD_LENGTH_OPTIONS} />
            </div>
            <span className="text-ink-500">~</span>
            <div className="w-[64px]">
              <Select value={String(value.max_len)}
                onChange={v => { const max = Number(v); const min = Math.min(max, value.min_len); onChange({ max_len: max, min_len: min }) }}
                options={WORD_LENGTH_OPTIONS} />
            </div>
          </div>
        </FilterRow>
        <FilterRow label="한글 읽기 가능">
          <Segmented value={value.can_read_yn === 'Y' ? '가능' : '불가'}
            onChange={v => onChange({ can_read_yn: v === '가능' ? 'Y' : 'N' })}
            options={['가능', '불가'] as const} />
        </FilterRow>
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

function nextScheduledDate(schedule: string[]): string | null {
  const DAY_MAP: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 }
  const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']
  const scheduledDows = new Set(schedule.map(d => DAY_MAP[d]).filter(n => n !== undefined))
  if (scheduledDows.size === 0) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today); date.setDate(today.getDate() + i)
    if (scheduledDows.has(date.getDay())) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}.${m}.${d} (${DAY_LABEL[date.getDay()]})`
    }
  }
  return null
}

function LargeOutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="h-9 px-5 rounded-[5px] border border-[#005744] text-[#005744] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition-colors">
      {children}
    </button>
  )
}
