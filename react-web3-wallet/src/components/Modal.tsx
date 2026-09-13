import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  /** 是否打开（受控） */
  open: boolean
  /** 关闭回调（用户点 X、点背景、按 ESC 都会触发） */
  onClose: () => void
  /** 标题 */
  title: string
  /** 副标题/说明 */
  subtitle?: string
  /** 弹窗内容 */
  children: ReactNode
}

/**
 * 通用 Modal 组件，基于原生 <dialog> 元素
 *
 * 优势：
 * - 零依赖（不需要 headlessui / radix）
 * - 自带焦点陷阱、ESC 关闭、背景锁定
 * - ::backdrop 伪元素原生支持遮罩
 *
 * 用法：
 *   const [open, setOpen] = useState(false)
 *   <Modal open={open} onClose={() => setOpen(false)} title="存款">
 *     <NewDeposit />
 *   </Modal>
 */
export default function Modal({ open, onClose, title, subtitle, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // 同步 open 状态到 <dialog>
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // 监听 <dialog> 的 close 事件（ESC 触发）
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  /**
   * 点击背景关闭（但点击内容区不关闭）
   * <dialog> 的 ::backdrop 是伪元素，点击事件 target 是 dialog 本身
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleBackdropClick}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="关闭"
          >
            ✕
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  )
}
