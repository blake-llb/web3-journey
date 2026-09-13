import { useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { useAaveWithdraw } from '../hooks/useAaveWithdraw'
import { isSepolia } from '../config/chains'
import styles from './Withdraw.module.css'

/**
 * Withdraw 页面：从 Aave 取款
 *
 * 三种操作：
 *   1. 取款到 WETH  : 1 笔交易 (Aave.withdraw)
 *   2. 取款到 ETH   : 2 笔交易 (Aave.withdraw → WETH.withdraw 自动串联)
 *   3. Unwrap 仅    : 把钱包里已有的 WETH 换回 ETH
 */
export default function Withdraw() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [amount, setAmount] = useState('')

  const {
    tokenSymbol,
    formattedATokenBalance,
    formattedWethBalance,
    formattedEthBalance,
    aTokenBalance,
    step,
    isSigning,
    isConfirming,
    isConfirmed,
    error,
    txHash,
    withdraw,
    withdrawAndUnwrap,
    reset,
  } = useAaveWithdraw('WETH')

  // 按钮状态：是否可点击 / 显示什么文字
  const buttonState = useMemo(() => {
    if (!isConnected) return { text: '连接钱包', disabled: true, hint: '' }

    let parsed: bigint
    try {
      parsed = amount ? parseEther(amount) : 0n
    } catch {
      return { text: '金额格式无效', disabled: true, hint: '' }
    }
    const hasValidAmount = parsed > 0n
    // aTokenBalance 还在链上读取时是 undefined，提示"加载中"避免误判
    const isBalanceLoading = aTokenBalance === undefined
    const hasEnoughDeposit = !isBalanceLoading && aTokenBalance >= parsed
    const isBusy = step !== 'idle' || isSigning || isConfirming

    if (!hasValidAmount) return { text: '输入金额', disabled: true, hint: '' }
    if (isBalanceLoading) return { text: '加载余额...', disabled: true, hint: '' }
    if (!hasEnoughDeposit) return { text: '存款余额不足', disabled: true, hint: '' }
    if (isBusy) {
      return {
        text: stepLabel(step, isSigning, isConfirming),
        disabled: true,
        hint: '',
      }
    }
    return {
      text: '取款到 WETH',
      disabled: false,
      hint: '从 Aave 提取，资金以 WETH 形式回到钱包',
    }
  }, [amount, isConnected, aTokenBalance, step, isSigning, isConfirming])

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.connectCard}>
          <span className={styles.connectIcon}>🔌</span>
          <h3>连接钱包</h3>
          <p>请先连接钱包以使用取款功能</p>
        </div>
      </div>
    )
  }

  // "MAX" 按钮：填入 aToken 余额
  const fillMax = () => {
    if (aTokenBalance !== undefined) {
      setAmount(formatEther(aTokenBalance))
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>🏦</span>
          <h3>取款</h3>
          <span className={styles.badge}>
            {isSepolia(chainId) ? 'Sepolia' : 'Mainnet'}
          </span>
        </div>

        {/* 存款余额高亮显示 */}
        <div className={styles.deposited}>
          <span className="label">📥 Aave 存款余额</span>
          <span className="value">
            {formattedATokenBalance} {tokenSymbol}
          </span>
        </div>

        {/* 钱包资产 */}
        <div className={styles.infoRow}>
          <span>ETH 余额</span>
          <span className="value">{formattedEthBalance} ETH</span>
        </div>
        <div className={styles.infoRow}>
          <span>WETH 余额</span>
          <span className="value">{formattedWethBalance} WETH</span>
        </div>

        {/* 金额输入 */}
        <div className={styles.field}>
          <label>取款金额</label>
          <div className={styles.inputWrap}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={step !== 'idle'}
            />
            <button
              type="button"
              onClick={fillMax}
              className={styles.maxBtn}
              disabled={step !== 'idle'}
            >
              MAX
            </button>
            <span className={styles.suffix}>{tokenSymbol}</span>
          </div>
        </div>

        {buttonState.hint && step === 'idle' && (
          <div className={styles.hint}>ℹ️ {buttonState.hint}</div>
        )}

        {/* 操作按钮组 */}
        <div className={styles.buttons}>
          <button
            onClick={() => withdraw(amount)}
            disabled={buttonState.disabled}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {buttonState.text}
          </button>
          <button
            onClick={() => withdrawAndUnwrap(amount)}
            disabled={buttonState.disabled}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            取款到 ETH（自动两步）
          </button>
        </div>

        {/* 状态显示 */}
        {isConfirmed && (
          <div className={`${styles.status} ${styles.statusSuccess}`}>
            ✅ 操作成功！
          </div>
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

function stepLabel(
  step: 'idle' | 'withdraw' | 'unwrap' | 'both',
  isSigning: boolean,
  isConfirming: boolean,
): string {
  if (isSigning) return '等待签名...'
  if (isConfirming) {
    if (step === 'withdraw') return '取款确认中...'
    if (step === 'unwrap') return '解包确认中...'
    if (step === 'both') return '确认中（两步）...'
  }
  switch (step) {
    case 'withdraw':
      return '取款中...'
    case 'unwrap':
      return '解包 WETH 中...'
    case 'both':
      return '取款 + 解包中...'
    default:
      return '处理中...'
  }
}
