import { useEffect, useRef, type RefObject } from 'react'

/**
 * 点击元素外部时触发回调
 *
 * 用法：
 *   const rootRef = useRef<HTMLDivElement>(null)
 *   useClickOutside(rootRef, () => setOpen(false), open)
 *   return <div ref={rootRef}>...</div>
 *
 * @param ref       目标元素的 ref（点击发生在它内部时不会触发）
 * @param onOutside 点击外部时执行的回调
 * @param enabled   是否启用监听，默认 true；传 false 可完全跳过（比如菜单没打开时）
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
) {
  // 用 ref 保存最新回调：这样 onOutside 每次渲染换了新函数，
  // 也不用重新挂监听，effect 只依赖 enabled
  const callbackRef = useRef(onOutside)
  useEffect(() => {
    callbackRef.current = onOutside
  })

  useEffect(() => {
    if (!enabled) return

    const handlePointerDown = (event: MouseEvent) => {
      // event.target 的类型是 EventTarget | null，用 instanceof 收窄成 Node
      if (
        ref.current &&
        event.target instanceof Node &&
        !ref.current.contains(event.target)
      ) {
        callbackRef.current()
      }
    }

    // 用 pointerdown 而不是 mousedown：鼠标、触摸、手写笔都能覆盖
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [ref, enabled])
}
