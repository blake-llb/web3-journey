import { useRef, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import {
  CHAIN_OPTIONS,
  getChainIcon,
  getChainName,
  type SupportedChainId,
} from '../config/chains'
import { useClickOutside } from '../hooks/useClickOutside'
import { useEscapeKey } from '../hooks/useEscapeKey'
import styles from './NetworkSwitcher.module.css'

/**
 * 网络切换器
 *
 * 触发器展示「当前网络」，点击后下拉列出可切换的网络。
 * 菜单项由 config/chains.ts 的 CHAIN_OPTIONS 自动生成，
 * 新增链只需改配置，这里无需改动。
 */
export default function NetworkSwitcher() {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const { switchChain, isPending, error } = useSwitchChain()

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击外部 / 按 Esc 关闭下拉
  const closeMenu = () => setOpen(false)
  useClickOutside(rootRef, closeMenu, open)
  useEscapeKey(closeMenu, open)

  // 选择网络；点击当前网络只关闭菜单
  const handleSelect = (targetChainId: SupportedChainId) => {
    setOpen(false)
    if (targetChainId === chainId || isPending) return
    switchChain({ chainId: targetChainId })
  }

  // 未连接钱包时没有"当前网络"，直接提示未连接
  const currentLabel = isConnected ? getChainName(chainId) : '未连接'
  const currentIcon = isConnected ? getChainIcon(chainId) : '🌐'

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
        disabled={!isConnected || isPending}
        title={!isConnected ? '请先连接钱包' : '切换网络'}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.triggerIcon}>{currentIcon}</span>
        <span className={styles.triggerLabel}>
          {isPending ? '切换中...' : currentLabel}
        </span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox" aria-label="可切换的网络">
          {CHAIN_OPTIONS.map((chain) => {
            const active = chain.id === chainId
            return (
              <li key={chain.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${styles.option} ${active ? styles.optionActive : ''}`}
                  onClick={() => handleSelect(chain.id)}
                >
                  <span className={styles.optionIcon}>{chain.icon}</span>
                  <span className={styles.optionLabel}>{chain.name}</span>
                  {active && <span className={styles.check}>✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {error && <div className={styles.errorMsg}>❌ {error.message}</div>}
    </div>
  )
}
