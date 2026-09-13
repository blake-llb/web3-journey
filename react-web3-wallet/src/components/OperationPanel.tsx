import { useChainId, useSwitchChain, useAccount, useDisconnect } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { getChainName } from '../config/chains'
import styles from './OperationPanel.module.css'

interface OperationPanelProps {
  /** 点击"存款"按钮的回调（由父组件打开 Modal） */
  onDeposit: () => void
  /** 点击"取款"按钮的回调 */
  onWithdraw: () => void
}

/**
 * 操作面板：把"网络切换 + 业务操作 + 断开连接"集中在一处
 *
 * 按钮采用统一的 plain 风格（白底 + 灰边 + hover 蓝），
 * 后续要加新操作（比如 Stake、Swap、桥接），
 * 只需在 opButtons 数组里追加一项，UI 自动适配。
 */
export default function OperationPanel({ onDeposit, onWithdraw }: OperationPanelProps) {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending, error } = useSwitchChain()

  // 网络状态判断
  const onSepolia = chainId === sepolia.id
  const onMainnet = chainId === mainnet.id
  const showSepoliaBtn = !onSepolia
  const showMainnetBtn = !onMainnet

  /**
   * 后续要加新操作，在这里追加即可
   * 每个按钮的样式都一致，调用 onXxx 回调即可
   */
  const opButtons = [
    { key: 'deposit', label: '💰 存款', onClick: onDeposit },
    { key: 'withdraw', label: '🏦 取款', onClick: onWithdraw },
    // 👇 后续在这里加新按钮
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.icon}>⚙️</span>
        <h3>操作</h3>
        <span className={styles.networkBadge}>{getChainName(chainId)}</span>
      </div>

      {/* 网络切换 */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>网络</div>
        <div className={styles.networkButtons}>
          {showSepoliaBtn && (
            <button
              className={styles.btn}
              onClick={() => switchChain({ chainId: sepolia.id })}
              disabled={isPending}
            >
              🧪 测试网
            </button>
          )}
          {showMainnetBtn && (
            <button
              className={styles.btn}
              onClick={() => switchChain({ chainId: mainnet.id })}
              disabled={isPending}
            >
              🔷 主网
            </button>
          )}
          {!showSepoliaBtn && !showMainnetBtn && (
            <span className={styles.note}>✓ 已在目标网络</span>
          )}
        </div>
      </div>

      {error && <div className={styles.errorMsg}>❌ {error.message}</div>}

      <div className={styles.divider} />

      {/* 业务操作（未连接时禁用） */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>操作</div>
        <div className={styles.opGrid}>
          {opButtons.map((op) => (
            <button
              key={op.key}
              className={styles.btn}
              onClick={op.onClick}
              disabled={!isConnected}
              title={!isConnected ? '请先连接钱包' : undefined}
            >
              {op.label}
            </button>
          ))}
        </div>
        {!isConnected && (
          <div className={styles.note} style={{ padding: '4px 0 0' }}>
            请先连接钱包
          </div>
        )}
      </div>

      {/* 断开连接（仅连接时显示） */}
      {isConnected && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <div className={styles.sectionLabel}>账户</div>
            <button
              className={`${styles.btn} ${styles.dangerBtn}`}
              onClick={() => disconnect()}
            >
              🚪 断开连接
            </button>
          </div>
        </>
      )}
    </div>
  )
}
