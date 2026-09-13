import { mainnet, sepolia } from 'wagmi/chains'

/**
 * 应用支持的所有链
 * 集中维护，方便后续加新链（arbitrum、optimism、base 等）
 */
export const SUPPORTED_CHAINS = [mainnet, sepolia] as const

/**
 * 用数字 ID 引用链，避免到处写魔法数字
 */
export const CHAIN_IDS = {
  mainnet: mainnet.id,
  sepolia: sepolia.id,
} as const

/**
 * 链 ID → 中文显示名（用于 UI）
 */
export const CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum 主网',
  [sepolia.id]: 'Sepolia 测试网',
}

/**
 * 网络判断工具函数
 * 用法：if (isSepolia(chainId)) { ... }
 */
export const isSepolia = (chainId: number | undefined): boolean =>
  chainId === sepolia.id

export const isMainnet = (chainId: number | undefined): boolean =>
  chainId === mainnet.id

/**
 * 获取链的中文名称，未知网络 fallback
 */
export function getChainName(chainId: number | undefined): string {
  if (chainId === undefined) return '未连接'
  return CHAIN_NAMES[chainId] ?? `未知网络 (${chainId})`
}
