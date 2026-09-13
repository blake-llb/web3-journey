import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi'
import {
  formatEther,
  parseEther,
  erc20Abi,
  type Address,
} from 'viem'
import { AAVE_POOL_ABI } from '../abis/aavePool'
import { WETH_ABI } from '../abis/weth'
import { getAavePoolAddress } from '../config/aave'
import { getTokenAddress, getToken } from '../config/tokens'

/**
 * 存款流程的步骤状态机
 * - idle    : 空闲
 * - wrap    : ETH → WETH 正在处理（自动触发，用户不需要感知）
 * - approve : 授权 Aave 使用 WETH 正在处理
 * - deposit : 存入 Aave 正在处理
 */
export type DepositStep = 'idle' | 'wrap' | 'approve' | 'deposit'

type SubStep = 'wrap' | 'approve' | 'deposit'

/** 编排流水线：自动按需 wrap → approve → deposit，用户只需点一次"存入 Aave" */
interface PipelineState {
  /** 用户输入的金额（用于 deposit） */
  amount: bigint
  /** 步骤列表 */
  steps: SubStep[]
  /** 当前正在执行的步骤索引 */
  currentIdx: number
}

/** uint256 最大值，用于"无限授权"，省 gas */
const MAX_UINT256 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn

export interface UseAaveSupplyReturn {
  /** 当前网络相关地址（链上无该 token 配置时为 undefined） */
  tokenSymbol: string
  tokenAddress: Address | undefined
  poolAddress: Address | undefined

  /** 原始余额（bigint，undefined 表示还没读到） */
  ethBalance: bigint | undefined
  tokenBalance: bigint | undefined
  allowance: bigint | undefined

  /** 已格式化的字符串（用于 UI 直接展示，固定 4 位小数） */
  formattedEthBalance: string
  formattedTokenBalance: string

  /** 状态机 */
  step: DepositStep
  /** 钱包正在弹出签名窗口 */
  isSigning: boolean
  /** 交易已发，等链上确认 */
  isConfirming: boolean
  /** 最近一笔交易已确认成功 */
  isConfirmed: boolean
  /** 错误信息（用户可读） */
  error: string | null
  /** 最近一笔交易的 hash（用于 etherscan 跳转） */
  txHash: `0x${string}` | null

  /**
   * 一键存款（推荐入口）：内部自动按需 wrap → approve → deposit，
   * 用户只需要点一次按钮，看到分步状态即可。
   */
  supply: (amount: string) => Promise<void>
  /** 单步操作（保留供高级用法） */
  wrap: (amount: string) => Promise<void>
  approve: () => Promise<void>
  deposit: (amount: string) => Promise<void>
  /** 清空 error/txHash，给 UI 一个"重置"按钮用 */
  reset: () => void
}

/**
 * 把"向 Aave 存款"这件事封成一个 hook
 *
 * 组件层最简单的用法：
 *   const { supply, formattedEthBalance } = useAaveSupply()
 *   await supply(amount)   // 自动 wrap → approve → deposit
 *
 * 也可以分步调用 wrap / approve / deposit。
 */
export function useAaveSupply(tokenSymbol: string = 'WETH'): UseAaveSupplyReturn {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  // ================ 地址（按当前网络动态获取） ================
  const token = getToken(tokenSymbol)
  const tokenAddress = getTokenAddress(tokenSymbol, chainId)
  const poolAddress = getAavePoolAddress(chainId)

  // ================ 状态机 ================
  const [step, setStep] = useState<DepositStep>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<PipelineState | null>(null)

  // 防止 isConfirmed=true 时 effect 多次执行导致流水线误推进
  const advancingRef = useRef(false)

  // ================ 链上读取 ================
  const { data: ethBalanceData, refetch: refetchEthBalance } = useBalance({ address })
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress },
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && poolAddress ? [address, poolAddress] : undefined,
    query: { enabled: !!address && !!tokenAddress && !!poolAddress },
  })

  // ================ 写合约能力 ================
  const { writeContractAsync, isPending: isSigning, error: writeError } = useWriteContract()

  // ================ 等待交易回执 ================
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isTxFailed,
    error: txError,
  } = useWaitForTransactionReceipt({ hash: txHash ?? undefined })

  // ================ 执行单个子步骤（发一笔交易） ================
  const executeSubStep = useCallback(
    async (subStep: SubStep, amount: bigint) => {
      if (!tokenAddress || !poolAddress || !address) {
        setError('当前网络不支持该代币')
        setStep('idle')
        setPipeline(null)
        advancingRef.current = false
        return
      }
      setStep(subStep)
      setError(null)
      try {
        let hash: `0x${string}`
        if (subStep === 'wrap') {
          // ETH → WETH，value 即 wrap 数量
          hash = await writeContractAsync({
            address: tokenAddress,
            abi: WETH_ABI,
            functionName: 'deposit',
            args: [],
            value: amount,
          })
        } else if (subStep === 'approve') {
          // 无限授权（max uint256），后续 deposit 不用再授权
          hash = await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [poolAddress, MAX_UINT256],
          })
        } else {
          // 存入 Aave
          hash = await writeContractAsync({
            address: poolAddress,
            abi: AAVE_POOL_ABI,
            functionName: 'supply',
            args: [tokenAddress, amount, address, 0],
          })
        }
        setTxHash(hash)
      } catch (err) {
        setError(err instanceof Error ? err.message : '操作失败')
        setStep('idle')
        setTxHash(null)
        setPipeline(null)
        advancingRef.current = false
      }
    },
    [tokenAddress, poolAddress, address, writeContractAsync],
  )

  // ================ 一键存款入口（编排 wrap → approve → deposit） ================
  const supply = useCallback(
    async (amountStr: string) => {
      if (!isConnected) {
        setError('请先连接钱包')
        return
      }
      if (!tokenAddress || !poolAddress || !address) {
        setError('当前网络不支持该代币')
        return
      }
      if (pipeline) {
        // 流水线已经在跑，重复点击直接忽略
        return
      }
      let parsed: bigint
      try {
        parsed = parseEther(amountStr)
      } catch {
        setError('金额格式无效')
        return
      }
      if (parsed === 0n) return

      // 计算需要哪些步骤
      const tokenBal = tokenBalance ?? 0n
      const allow = allowance ?? 0n
      const wrapAmount = tokenBal < parsed ? parsed - tokenBal : 0n

      const steps: SubStep[] = []
      if (wrapAmount > 0n) steps.push('wrap')
      if (allow < parsed) steps.push('approve')
      steps.push('deposit')

      if (steps.length === 1 && steps[0] === 'deposit') {
        // 余额和授权都够，直接存款（不进入流水线，简化路径）
        setError(null)
        await executeSubStep('deposit', parsed)
        return
      }

      setError(null)
      setPipeline({ amount: parsed, steps, currentIdx: 0 })
      // 触发第一步（wrap 步骤的金额是缺口，不是全额）
      await executeSubStep(steps[0], steps[0] === 'wrap' ? wrapAmount : parsed)
    },
    [
      isConnected,
      tokenAddress,
      poolAddress,
      address,
      tokenBalance,
      allowance,
      executeSubStep,
      pipeline,
    ],
  )

  // ================ 流水线推进：交易确认后自动进入下一步 ================
  useEffect(() => {
    if (!isConfirmed || !pipeline) {
      // 没有流水线 或 当前不处于确认成功状态 → 重置 guard
      advancingRef.current = false
      return
    }
    if (advancingRef.current) return // 本次确认已经处理过

    advancingRef.current = true

    const nextIdx = pipeline.currentIdx + 1
    if (nextIdx >= pipeline.steps.length) {
      // 全部完成：清理状态 + 刷新所有余额
      setPipeline(null)
      setStep('idle')
      setTxHash(null)
      advancingRef.current = false
      refetchEthBalance()
      refetchTokenBalance()
      refetchAllowance()
      return
    }

    // 进入下一步（deposit 用全额，approve 不用金额参数）
    setPipeline({ ...pipeline, currentIdx: nextIdx })
    void executeSubStep(pipeline.steps[nextIdx], pipeline.amount)
  }, [
    isConfirmed,
    pipeline,
    executeSubStep,
    refetchEthBalance,
    refetchTokenBalance,
    refetchAllowance,
  ])

  // ================ 副作用：交易失败 / 写合约错误 ================
  useEffect(() => {
    if (isTxFailed && txError) {
      setStep('idle')
      setTxHash(null)
      setPipeline(null)
      advancingRef.current = false
      setError(txError.message || '交易失败')
    }
  }, [isTxFailed, txError])

  useEffect(() => {
    if (writeError) {
      setStep('idle')
      setPipeline(null)
      advancingRef.current = false
      setError(writeError.message)
    }
  }, [writeError])

  // ================ 单步操作（保留供高级用法） ================
  const wrap = useCallback(
    async (amount: string) => {
      if (!isConnected || !tokenAddress) return
      let parsed: bigint
      try {
        parsed = parseEther(amount)
      } catch {
        return
      }
      if (parsed === 0n) return
      await executeSubStep('wrap', parsed)
    },
    [isConnected, tokenAddress, executeSubStep],
  )

  const approve = useCallback(async () => {
    if (!isConnected) return
    await executeSubStep('approve', 0n)
  }, [isConnected, executeSubStep])

  const deposit = useCallback(
    async (amount: string) => {
      if (!isConnected) return
      let parsed: bigint
      try {
        parsed = parseEther(amount)
      } catch {
        return
      }
      if (parsed === 0n) return
      await executeSubStep('deposit', parsed)
    },
    [isConnected, executeSubStep],
  )

  const reset = useCallback(() => {
    setError(null)
    setTxHash(null)
    setStep('idle')
    setPipeline(null)
    advancingRef.current = false
  }, [])

  // ================ 格式化输出（统一 4 位小数） ================
  const ethBalance = ethBalanceData?.value
  const formattedEthBalance =
    ethBalance !== undefined ? parseFloat(formatEther(ethBalance)).toFixed(4) : '0.0000'
  const formattedTokenBalance =
    tokenBalance !== undefined ? parseFloat(formatEther(tokenBalance)).toFixed(4) : '0.0000'

  return {
    tokenSymbol: token?.symbol ?? tokenSymbol,
    tokenAddress,
    poolAddress,
    ethBalance,
    tokenBalance,
    allowance,
    formattedEthBalance,
    formattedTokenBalance,
    step,
    isSigning,
    isConfirming,
    isConfirmed,
    error,
    txHash,
    supply,
    wrap,
    approve,
    deposit,
    reset,
  }
}