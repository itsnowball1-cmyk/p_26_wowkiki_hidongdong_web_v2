import { useEffect, useState } from 'react'
import Modal, { ModalCloseButton } from './Modal'
import { api, type AssignedChild, type ChildFolder } from '../lib/api'

type Props = {
  assigned: AssignedChild[]
  activeFolderId: number | null
  onActiveFolderChange: (id: number | null) => void
  onFoldersChange: (folders: ChildFolder[]) => void
}

export default function FolderModals({ assigned, activeFolderId, onActiveFolderChange, onFoldersChange }: Props) {
  const [folders, setFolders] = useState<ChildFolder[]>([])
  const [manageOpen, setManageOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftChildIds, setDraftChildIds] = useState<number[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<ChildFolder | null>(null)
  const [saving, setSaving] = useState(false)

  const refetch = async () => {
    const list = await api.childFolders()
    setFolders(list)
    onFoldersChange(list)
  }

  useEffect(() => {
    refetch().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setDraftName('')
    setDraftChildIds([])
    setEditOpen(true)
  }

  const openEdit = (f: ChildFolder) => {
    setEditingId(f.id)
    setDraftName(f.folder_name)
    setDraftChildIds(f.child_ids)
    setEditOpen(true)
  }

  const openPicker = () => {
    setPickerSelected(new Set(draftChildIds))
    setPickerQuery('')
    setPickerOpen(true)
  }

  const confirmPicker = () => {
    setDraftChildIds([...pickerSelected])
    setPickerOpen(false)
  }

  const removeDraftChild = (id: number) => setDraftChildIds((prev) => prev.filter((x) => x !== id))

  const togglePicker = (id: number) => {
    setPickerSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveFolder = async () => {
    const name = draftName.trim()
    if (!name || saving) return
    setSaving(true)
    try {
      if (editingId == null) await api.createChildFolder(name, draftChildIds)
      else await api.updateChildFolder(editingId, name, draftChildIds)
      setEditOpen(false)
      await refetch()
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await api.deleteChildFolder(deleteTarget.id)
    if (activeFolderId === deleteTarget.id) onActiveFolderChange(null)
    setDeleteTarget(null)
    await refetch()
  }

  const q = pickerQuery.trim().toLowerCase()
  const pickerList = assigned.filter((c) => {
    if (!q) return true
    return [c.child_name, c.identifier, c.app_login_id].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
  })
  const draftChildren = assigned.filter((c) => draftChildIds.includes(c.id))

  return (
    <>
      <div className="flex items-center gap-2">
        <TabButton label="전체" active={activeFolderId === null} onClick={() => onActiveFolderChange(null)} />
        {folders.map((f) => (
          <TabButton key={f.id} label={f.folder_name} active={activeFolderId === f.id} onClick={() => onActiveFolderChange(f.id)} />
        ))}
        <button
          type="button"
          onClick={() => { if (folders.length === 0) openCreate(); else setManageOpen(true) }}
          aria-label="폴더 관리"
          className="w-11 h-11 shrink-0 grid place-items-center rounded-[10px] border border-line text-ink-400 hover:bg-surface-active transition"
        >
          <FolderManageIcon />
        </button>
      </div>

      {/* 폴더 관리 */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} className="w-[420px] p-6">
        <ModalCloseButton onClose={() => setManageOpen(false)} />
        <h3 className="text-[17px] font-semibold mb-4">폴더 관리</h3>
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {folders.length === 0 && <p className="text-ink-400 text-[14px] py-6 text-center">만든 폴더가 없습니다.</p>}
          {folders.map((f) => (
            <div key={f.id} className="flex items-center justify-between h-11 px-3 rounded-[5px] border border-line">
              <span className="text-[15px] text-ink-800">{f.folder_name}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setManageOpen(false); openEdit(f) }}
                  aria-label={`${f.folder_name} 수정`}
                  className="text-ink-400 hover:text-ink-700"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(f)}
                  aria-label={`${f.folder_name} 삭제`}
                  className="text-ink-400 hover:text-red-600"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setManageOpen(false); openCreate() }}
          className="w-full h-10 mt-4 rounded-[5px] border border-dashed border-line-dark text-ink-600 text-[15px] hover:bg-surface-active transition"
        >
          + 폴더 만들기
        </button>
      </Modal>

      {/* 폴더 만들기 / 수정 */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} className="w-[420px] p-6">
        <ModalCloseButton onClose={() => setEditOpen(false)} />
        <h3 className="text-[17px] font-semibold mb-4">폴더 만들기</h3>

        <label className="block text-[13px] text-ink-500 mb-1">폴더 이름</label>
        <div className="relative mb-5">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value.slice(0, 10))}
            placeholder="폴더 이름을 입력해주세요."
            maxLength={10}
            className="w-full h-10 px-3 pr-12 rounded-[5px] border border-line-input text-[15px] focus:outline-none focus:border-brand"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">{draftName.length}/10</span>
        </div>

        <label className="block text-[13px] text-ink-500 mb-2">등록된 아동</label>
        <div className="space-y-2 max-h-[220px] overflow-y-auto mb-5">
          <button
            type="button"
            onClick={openPicker}
            className="w-full h-10 rounded-[5px] border border-dashed border-line-dark text-ink-600 text-[15px] hover:bg-surface-active transition"
          >
            + 아동 추가하기
          </button>
          {draftChildren.map((c) => (
            <div key={c.id} className="flex items-center justify-between h-11 px-3 rounded-[5px] border border-line">
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink-800">
                {c.child_name ?? '-'}{c.age_label ? `(${c.age_label})` : ''}
                <span className="text-ink-400 text-[13px] ml-2">아이디:{c.app_login_id ?? '-'}</span>
              </span>
              <button
                type="button"
                onClick={() => removeDraftChild(c.id)}
                className="h-8 px-3 ml-2 shrink-0 rounded-[5px] border border-line-input text-[13px] text-ink-600 hover:bg-surface-active transition"
              >
                해제
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditOpen(false)}
            className="flex-1 h-10 rounded-[5px] border border-line-input text-ink-700 text-[15px] hover:bg-surface-active transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={saveFolder}
            disabled={!draftName.trim() || saving}
            className="flex-1 h-10 rounded-[5px] bg-brand text-white text-[15px] font-medium disabled:bg-ink-300 disabled:cursor-not-allowed hover:opacity-90 transition"
          >
            확인
          </button>
        </div>
      </Modal>

      {/* 아동 선택 */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} className="w-[420px] p-6">
        <ModalCloseButton onClose={() => setPickerOpen(false)} />
        <h3 className="text-[17px] font-semibold mb-4">아동 선택</h3>
        <input
          value={pickerQuery}
          onChange={(e) => setPickerQuery(e.target.value)}
          placeholder="아동 이름 혹은 아이디 검색"
          className="w-full h-10 px-3 mb-4 rounded-[5px] border border-line-input text-[15px] focus:outline-none focus:border-brand"
        />
        <div className="space-y-1 max-h-[320px] overflow-y-auto mb-4">
          {pickerList.length === 0 && <p className="text-ink-400 text-[14px] py-6 text-center">검색 결과가 없습니다.</p>}
          {pickerList.map((c) => (
            <label key={c.id} className="flex items-center justify-between gap-2 h-12 px-2 rounded-[5px] hover:bg-surface-active cursor-pointer">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-ink-800">
                  {c.child_name ?? '-'}{c.age_label ? `(${c.age_label})` : ''}
                </span>
                <span className="block truncate text-ink-400 text-[13px]">아이디:{c.app_login_id ?? '-'}</span>
              </span>
              <input
                type="checkbox"
                checked={pickerSelected.has(c.id)}
                onChange={() => togglePicker(c.id)}
                className="w-5 h-5 shrink-0 rounded-full border border-line-dark accent-brand"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="flex-1 h-10 rounded-[5px] border border-line-input text-ink-700 text-[15px] hover:bg-surface-active transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={confirmPicker}
            className="flex-1 h-10 rounded-[5px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition"
          >
            선택 {pickerSelected.size}
          </button>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} className="w-[380px] p-6 text-center">
        <ModalCloseButton onClose={() => setDeleteTarget(null)} />
        <h3 className="text-[17px] font-semibold mb-3">폴더 삭제</h3>
        <p className="text-[14px] text-ink-600 mb-6 leading-relaxed">
          해당 폴더를 삭제하시겠습니까?<br />
          폴더를 삭제해도 아동은 삭제되지 않으며, 아동관리 목록에 유지됩니다.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={confirmDelete}
            className="flex-1 h-10 rounded-[5px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="flex-1 h-10 rounded-[5px] border border-line-input text-ink-700 text-[15px] hover:bg-surface-active transition"
          >
            취소
          </button>
        </div>
      </Modal>
    </>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 px-6 shrink-0 rounded-[10px] text-[15px] transition ${
        active ? 'bg-brand text-white font-semibold' : 'border border-line text-ink-400 font-medium hover:bg-surface-active'
      }`}
    >
      {label}
    </button>
  )
}

function FolderManageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M2 8h8M2 12h4" />
      <path d="M12 10v4M10 12h4" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2l3 3-8 8H3v-3l8-8Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6 4V2.5h4V4M4.5 4l.5 9.5h6l.5-9.5" />
    </svg>
  )
}
