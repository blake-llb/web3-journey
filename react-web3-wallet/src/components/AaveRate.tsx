import React from 'react'
import { useReadContract, useChainId } from 'wagmi'
import { AAVE_POOL_ABI } from '../abis/aavePool'
import { getAavePoolAddress } from '../config/aave'
import { getTokenAddress, TOKENS } from '../config/tokens'
import { getChainName } from '../config/chains'

/**
 * AaveRate：纯展示组件（无外层卡片）
 * 只负责读取并展示 Aave V3 池子中 WETH 的实时存款利率
 * 现在作为内嵌区块，由 App 的左侧组合卡片提供外层容器
 * 网络切换、存款、取款这些"操作"全部在 OperationPanel
 */
const AaveRate: React.FC = () => {
  const chainId = useChainId()

  // 根据当前网络动态选择合约地址和资产地址
  const poolAddress = getAavePoolAddress(chainId)
  const wethAddress = getTokenAddress('WETH', chainId)

  const { data, isLoading, isError, error } = useReadContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: 'getReserveData',
    args: wethAddress ? [wethAddress] : undefined,
    chainId,
  })

  // 安全转换 BigInt 到 Number，避免精度丢失
  const safeBigIntToNumber = (value: bigint | number | undefined): number => {
    if (value === undefined || value === null) return 0
    try {
      return typeof value === 'bigint' ? Number(value) : Number(value)
    } catch {
      return 0
    }
  }

  // 计算利率
  const getRateDisplay = () => {
    if (isLoading) return '加载中...'
    if (isError) return '出错了'
    if (!data) return '无数据'

    const reserveData = Array.isArray(data) ? data[0] : data
    const liquidityRate = reserveData?.currentLiquidityRate
    const rate = (safeBigIntToNumber(liquidityRate) / 1e27) * 100
    return `${rate.toFixed(2)}%`
  }

  // 处理错误点击，显示详细信息弹窗
  const handleErrorClick = () => {
    if (isError && error) {
      alert(`错误详情：\n\n${error.message}\n\n错误名称：${error.name || 'Unknown Error'}`)
    }
  }

  return (
    <div className="info-row rate-row">
      <span className="row-icon">📊</span>
      <span className="row-label">
        Aave {TOKENS.WETH.symbol} 存款利率
        <small className="row-sublabel">{getChainName(chainId)}</small>
      </span>
      <span
        className="row-value rate-value"
        onClick={handleErrorClick}
        style={{
          color: isError ? '#f00' : '#10b981',
          cursor: isError ? 'pointer' : 'default',
          textDecoration: isError ? 'underline' : 'none',
        }}
      >
        {getRateDisplay()}
      </span>
    </div>
  )
}

export default AaveRate
