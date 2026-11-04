import { useEffect, useRef } from 'react'

/**
 * 按下键盘 Esc 时触发回调
 *
 * 用法：
 *   useEscapeKey(() => setOpen(false), open)
 *
 * @param onEscape 按下 Esc 时执行的回调
 * @param enabled  是否启用监听，默认 true；传 false 可完全跳过
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const callbackRef = useRef(onEscape)
  useEffect(() => {
    callbackRef.current = onEscape
  })

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') callbackRef.current()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
