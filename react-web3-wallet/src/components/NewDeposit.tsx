import { useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { parseEther } from 'viem'
import { useAaveSupply, type DepositStep } from '../hooks/useAaveSupply'
import { isSepolia } from '../config/chains'
import styles from './NewDeposit.module.css'

/**
 * 存款弹窗
 *
 * 设计要点：
 * - 用户只看到"ETH 余额"和"存入金额"，不需要关心 WETH 这层抽象
 * - 一键"存入 Aave"按钮背后自动按需执行 wrap → approve → deposit
 * - 步骤状态实时展示（准备中 / 授权中 / 存款中），让用户知道在做什么
 */
export default function NewDeposit() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [amount, setAmount] = useState('')

  const {
    tokenSymbol,
    formattedEthBalance,
    ethBalance,
    step,
    isSigning,
    isConfirming,
    isConfirmed,
    error,
    txHash,
    supply,
    reset,
  } = useAaveSupply('WETH')

  // 按钮状态：纯派生数据，独立可测
  const buttonState = useMemo(() => {
    const parsed = (() => {
      try {
        return amount ? parseEther(amount) : 0n
      } catch {
        return 0n
      }
    })()
    const hasValidAmount = parsed > 0n
    const hasEthBalance = ethBalance !== undefined && ethBalance >= parsed
    const isBusy = step !== 'idle' || isSigning || isConfirming

    if (!isConnected) return { text: '连接钱包', disabled: true, hint: '' }
    if (!hasValidAmount) return { text: '输入金额', disabled: true, hint: '' }
    if (!hasEthBalance) return { text: 'ETH 余额不足', disabled: true, hint: '' }
    if (isBusy) return { text: stepLabel(step, isSigning, isConfirming), disabled: true, hint: '' }

    return {
      text: '存入 Aave',
      disabled: false,
      hint: '将 ETH 存入 Aave 开始赚取存款利息',
    }
  }, [amount, isConnected, ethBalance, step, isSigning, isConfirming])

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.connectCard}>
          <span className={styles.connectIcon}>🔌</span>
          <h3>连接钱包</h3>
          <p>请先连接钱包以使用存款功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>💰</span>
          <h3>{tokenSymbol} 存款</h3>
          <span className={styles.badge}>{isSepolia(chainId) ? 'Sepolia' : 'Mainnet'}</span>
        </div>

        {/* 只展示 ETH 余额，不暴露 WETH 这层抽象 */}
        <div className={styles.infoRow}>
          <span>ETH 余额</span>
          <span className="value">{formattedEthBalance} ETH</span>
        </div>

        <div className={styles.field}>
          <label>存款金额</label>
          <div className={styles.inputWrap}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0000"
              disabled={step !== 'idle'}
            />
            <span className={styles.suffix}>ETH</span>
          </div>
        </div>

        {buttonState.hint && step === 'idle' && (
          <div className={styles.hint}>ℹ️ {buttonState.hint}</div>
        )}

        {/* 一键存款：内部自动 wrap → approve → deposit */}
        <button
          onClick={() => supply(amount)}
          disabled={buttonState.disabled}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          {buttonState.text}
        </button>

        {/* 状态显示 */}
        {isConfirmed && (
          <div className={`${styles.status} ${styles.statusSuccess}`}>✅ 存款成功！</div>
        )}
        {error && (
          <div
            className={`${styles.status} ${styles.statusError}`}
            onClick={reset}
            style={{ cursor: 'pointer' }}
            title="点击清除错误"
          >
            ❌ {error}
          </div>
        )}

        {txHash && (
          <div className={styles.txInfo}>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 查看交易详情
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

/** 把"当前正在执行的子步骤"翻译成中文文案给用户看 */
function stepLabel(step: DepositStep, isSigning: boolean, isConfirming: boolean): string {
  if (isSigning) return '等待签名...'
  if (isConfirming) {
    if (step === 'wrap') return '确认中...'
    if (step === 'approve') return '授权确认中...'
    if (step === 'deposit') return '存款确认中...'
  }
  switch (step) {
    case 'wrap':
      return '准备中...'
    case 'approve':
      return '授权中...'
    case 'deposit':
      return '存款中...'
    default:
      return '处理中...'
  }
}