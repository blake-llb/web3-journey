import { useCallback, useEffect, useState } from 'react'
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
 * 取款流程的步骤状态机
 * - idle     : 空闲
 * - withdraw : Aave.withdraw() 正在处理（取出 → WETH）
 * - unwrap   : WETH.withdraw() 正在处理（WETH → ETH）
 * - both     : 用户选了"取款并换为 ETH"模式，正在连续发两笔交易
 *
 * Aave V3 的 aToken 是 rebasing 的（余额随累积利息增长），
 * 所以用户界面上看到的 aToken 余额 ≈ WETH 余额
 */
export type WithdrawStep = 'idle' | 'withdraw' | 'unwrap' | 'both'

export interface UseAaveWithdrawReturn {
  /** 当前网络相关地址 */
  tokenSymbol: string
  tokenAddress: Address | undefined
  poolAddress: Address | undefined

  /** 用户的链上资产（bigint，可能为 undefined 表示还没读到） */
  /** 用户钱包里的 ETH 余额 */
  ethBalance: bigint | undefined
  /** 用户钱包里的 WETH 余额 */
  wethBalance: bigint | undefined
  /** 用户在 Aave 里的存款（aToken 余额，约等于 underlying 资产数量） */
  aTokenBalance: bigint | undefined

  /** 已格式化的字符串（直接用于 UI） */
  formattedEthBalance: string
  formattedWethBalance: string
  formattedATokenBalance: string

  /** 状态机 */
  step: WithdrawStep
  isSigning: boolean
  isConfirming: boolean
  isConfirmed: boolean
  error: string | null
  txHash: `0x${string}` | null

  /**
   * 取款到 WETH：调用 Aave.withdraw()，资金以 WETH 形式回到钱包
   * 不需要授权（Aave 是合约拥有 aToken，用户对自己的存款有取款权）
   */
  withdraw: (amount: string) => Promise<void>
  /**
   * 把钱包里的 WETH 换回 ETH：调用 WETH.withdraw()
   * 不会动 Aave 里的存款
   */
  unwrap: (amount: string) => Promise<void>
  /**
   * 取款到 ETH：一步到位（先 Aave.withdraw → WETH，再 WETH.withdraw → ETH）
   * 中间需要等第一笔交易确认才会发第二笔
   */
  withdrawAndUnwrap: (amount: string) => Promise<void>
  /**
   * 重置错误/状态
   */
  reset: () => void
}

/**
 * 把"从 Aave 取款"这件事封成一个 hook
 *
 * 读取数据：
 *   - 通过 getReserveData(WETH) 拿到 aToken 地址
 *   - 查 aToken.balanceOf(user) 得到存款余额
 *   - 查 WETH.balanceOf(user) 得到钱包里的 WETH
 *   - 用 useBalance 拿 ETH 余额
 *
 * 操作：
 *   - withdraw(amount) : Aave.withdraw(asset, amount, user) → 用户钱包收到 WETH
 *   - unwrap(amount)   : WETH.withdraw(amount) → 用户钱包收到 ETH
 */
export function useAaveWithdraw(tokenSymbol: string = 'WETH'): UseAaveWithdrawReturn {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  // ================ 地址 ================
  const token = getToken(tokenSymbol)
  const tokenAddress = getTokenAddress(tokenSymbol, chainId)
  const poolAddress = getAavePoolAddress(chainId)

  // ================ 状态机 ================
  const [step, setStep] = useState<WithdrawStep>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 用于"取款并换为 ETH"模式：记录两笔交易里的第一笔 hash，等它确认完再发第二笔
  const [pendingUnwrapAmount, setPendingUnwrapAmount] = useState<bigint | null>(null)

  // ================ 读取：ETH / WETH / aToken 余额 ================
  const { data: ethBalanceData } = useBalance({ address })

  // 第一步：通过 getReserveData 拿到 aToken 地址
  const { data: reserveData } = useReadContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: 'getReserveData',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: !!tokenAddress && !!poolAddress },
  })

  // aToken 地址：wagmi 推导出的是命名对象，直接取属性
  // ABI 里的 outputs 顺序：configuration, liquidityIndex, ..., aTokenAddress(第9个)
  const aTokenAddress = reserveData?.aTokenAddress

  // 第二步：查 aToken 余额（即用户存款）
  const {
    data: aTokenBalance,
    refetch: refetchATokenBalance,
  } = useReadContract({
    address: aTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!aTokenAddress && !!address },
  })

  // 第三步：查钱包里的 WETH 余额
  const {
    data: wethBalance,
    refetch: refetchWethBalance,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  })

  // ================ 写合约 ================
  const { writeContractAsync, isPending: isSigning, error: writeError } = useWriteContract()

  // ================ 等待回执 ================
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isTxFailed,
    error: txError,
  } = useWaitForTransactionReceipt({ hash: txHash ?? undefined })

  // ================ 副作用 ================
  // 交易失败：清理状态
  useEffect(() => {
    if (isTxFailed && txError) {
      setStep('idle')
      setError(txError.message || '交易失败')
      setPendingUnwrapAmount(null)
    }
  }, [isTxFailed, txError])

  // 写合约阶段报错（用户拒绝等）
  useEffect(() => {
    if (writeError) {
      setStep('idle')
      setError(writeError.message)
      setPendingUnwrapAmount(null)
    }
  }, [writeError])

  // 交易确认：判断是否需要进入下一步（unwrap 阶段）
  useEffect(() => {
    if (!isConfirmed) return
    // 刷新余额
    refetchATokenBalance()
    refetchWethBalance()

    if (step === 'withdraw' && pendingUnwrapAmount !== null) {
      // "取款并换为 ETH"模式：aave withdraw 已确认，进入 unwrap
      void doUnwrap(pendingUnwrapAmount)
    } else {
      // 单步操作完成
      setStep('idle')
      setTxHash(null)
      setPendingUnwrapAmount(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed])

  /**
   * 内部函数：执行 WETH → ETH 的解包
   * 用 useCallback 单独包一层是为了让 effect 能引用到
   */
  const doUnwrap = useCallback(
    async (amount: bigint) => {
      if (!tokenAddress) return
      setStep('unwrap')
      try {
        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: WETH_ABI,
          functionName: 'withdraw',
          args: [amount],
        })
        setTxHash(hash)
      } catch (err) {
        setError(err instanceof Error ? err.message : '解包失败')
        setStep('idle')
        setPendingUnwrapAmount(null)
      }
    },
    [tokenAddress, writeContractAsync],
  )

  /** 取款到 WETH */
  const withdraw = useCallback(
    async (amount: string) => {
      if (!isConnected) {
        setError('请先连接钱包')
        return
      }
      if (!address || !tokenAddress || !poolAddress) {
        setError('当前网络不支持该代币')
        return
      }
      let parsed: bigint
      try {
        parsed = parseEther(amount)
      } catch {
        setError('金额格式无效')
        return
      }
      if (parsed === 0n) return

      setError(null)
      setStep('withdraw')
      try {
        const hash = await writeContractAsync({
          address: poolAddress,
          abi: AAVE_POOL_ABI,
          functionName: 'withdraw',
          args: [tokenAddress, parsed, address],
        })
        setTxHash(hash)
      } catch (err) {
        setError(err instanceof Error ? err.message : '取款失败')
        setStep('idle')
      }
    },
    [isConnected, address, tokenAddress, poolAddress, writeContractAsync],
  )

  /**
   * 取款到 ETH（两步：先 Aave.withdraw → WETH，再 WETH.withdraw → ETH）
   * 第一步在 watch effect 里自动串联第二步
   */
  const withdrawAndUnwrap = useCallback(
    async (amount: string) => {
      if (!isConnected) {
        setError('请先连接钱包')
        return
      }
      if (!address || !tokenAddress || !poolAddress) {
        setError('当前网络不支持该代币')
        return
      }
      let parsed: bigint
      try {
        parsed = parseEther(amount)
      } catch {
        setError('金额格式无效')
        return
      }
      if (parsed === 0n) return

      setError(null)
      setStep('both')
      setPendingUnwrapAmount(parsed)
      try {
        const hash = await writeContractAsync({
          address: poolAddress,
          abi: AAVE_POOL_ABI,
          functionName: 'withdraw',
          args: [tokenAddress, parsed, address],
        })
        setTxHash(hash)
      } catch (err) {
        setError(err instanceof Error ? err.message : '取款失败')
        setStep('idle')
        setPendingUnwrapAmount(null)
      }
    },
    [isConnected, address, tokenAddress, poolAddress, writeContractAsync],
  )

  /**
   * 仅 unwrap：把钱包里已有的 WETH 换回 ETH（不涉及 Aave）
   * 单独暴露，方便用户在第一笔取款到 WETH 后再用
   */
  const unwrap = useCallback(
    async (amount: string) => {
      if (!isConnected) {
        setError('请先连接钱包')
        return
      }
      if (!tokenAddress) {
        setError('当前网络不支持该代币')
        return
      }
      let parsed: bigint
      try {
        parsed = parseEther(amount)
      } catch {
        setError('金额格式无效')
        return
      }
      if (parsed === 0n) return

      // 余额检查
      if (wethBalance !== undefined && wethBalance < parsed) {
        setError('WETH 余额不足')
        return
      }

      await doUnwrap(parsed)
    },
    [isConnected, tokenAddress, wethBalance, doUnwrap],
  )

  const reset = useCallback(() => {
    setError(null)
    setTxHash(null)
    setStep('idle')
    setPendingUnwrapAmount(null)
  }, [])

  // ================ 格式化输出（统一 4 位小数） ================
  const ethBalance = ethBalanceData?.value
  const formattedEthBalance =
    ethBalance !== undefined ? parseFloat(formatEther(ethBalance)).toFixed(4) : '0.0000'
  const formattedWethBalance =
    wethBalance !== undefined ? parseFloat(formatEther(wethBalance)).toFixed(4) : '0.0000'
  const formattedATokenBalance =
    aTokenBalance !== undefined ? parseFloat(formatEther(aTokenBalance)).toFixed(4) : '0.0000'

  return {
    tokenSymbol: token?.symbol ?? tokenSymbol,
    tokenAddress,
    poolAddress,
    ethBalance,
    wethBalance,
    aTokenBalance,
    formattedEthBalance,
    formattedWethBalance,
    formattedATokenBalance,
    step,
    isSigning,
    isConfirming,
    isConfirmed,
    error,
    txHash,
    withdraw,
    unwrap,
    withdrawAndUnwrap,
    reset,
  }
}
