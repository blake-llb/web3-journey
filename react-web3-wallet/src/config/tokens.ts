import type { Address } from 'viem'
import { mainnet, sepolia } from 'wagmi/chains'

/**
 * 代币配置接口
 * decimals 一定要填对！WETH=18，USDC=6，USDT=6
 */
export interface TokenConfig {
  symbol: string
  name: string
  decimals: number
  addresses: Record<number, Address>
}

/**
 * 按 symbol 索引的代币配置
 * 地址按链 ID 维护，加新链时只需在这里加一行
 */
export const TOKENS: Record<string, TokenConfig> = {
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    addresses: {
      [mainnet.id]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      // 注意：Aave Sepolia 市场用的是 Aave 官方测试 WETH（可从 Aave faucet 领取），
      // 不是 Sepolia 原生 WETH9(0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14)。
      // 用错地址会让 getReserveData 返回全 0，且 supply/withdraw 无法工作。
      [sepolia.id]: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c',
    },
  },
  // 后续可加：USDC、DAI 等
}

/**
 * 所有支持的代币列表（用于下拉选择）
 */
export const SUPPORTED_TOKENS: TokenConfig[] = Object.values(TOKENS)

/**
 * 获取当前链上某个代币的地址
 */
export function getTokenAddress(
  symbol: string,
  chainId: number | undefined,
): Address | undefined {
  const token = TOKENS[symbol]
  if (!token || chainId === undefined) return undefined
  return token.addresses[chainId]
}

/**
 * 获取代币配置
 */
export function getToken(symbol: string): TokenConfig | undefined {
  return TOKENS[symbol]
}
