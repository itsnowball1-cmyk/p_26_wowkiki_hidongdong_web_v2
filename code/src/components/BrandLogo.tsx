import { useAuth } from '../lib/auth'
import { useRouter } from '../lib/router'

type Size = 'sm' | 'md' | 'lg'

const HEIGHTS: Record<Size, number> = {
  sm: 30,
  md: 48,
  lg: 72
}

const ASPECT_RATIO = 337 / 90

export default function BrandLogo({ size = 'sm', as = 'button' }: { size?: Size; as?: 'button' | 'plain' }) {
  const { user } = useAuth()
  const { go } = useRouter()

  const height = HEIGHTS[size]
  const width = Math.round(height * ASPECT_RATIO)

  const img = (
    <img
      src="/logo.png"
      alt="하이동동"
      style={{ height, width }}
      className="block select-none"
      draggable={false}
    />
  )

  if (as === 'plain') return img

  return (
    <button
      type="button"
      onClick={() => go({ name: user ? 'list' : 'login' })}
      className="inline-block focus:outline-none hover:opacity-80 transition-opacity"
      aria-label="하이동동 홈"
    >
      {img}
    </button>
  )
}
