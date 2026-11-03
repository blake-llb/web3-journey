import { mainnet, sepolia } from 'wagmi/chains'

/**
 * 应用支持的所有链
 * 集中维护，方便后续加新链（arbitrum、optimism、base 等）
 */
export const SUPPORTED_CHAINS = [mainnet, sepolia] as const

/**
 * 支持链的 ID 联合类型（1 | 11155111）
 */
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id']

/**
 * 用数字 ID 引用链，避免到处写魔法数字
 */
export const CHAIN_IDS = {
  mainnet: mainnet.id,
  sepolia: sepolia.id,
} as const

/**
 * 链的 UI 元信息（中文名 + 图标）
 * 新增链步骤：1) 加进 SUPPORTED_CHAINS；2) 在这里补一条
 */
export const CHAIN_META: Record<number, { name: string; icon: string }> = {
  [mainnet.id]: { name: 'Ethereum 主网', icon: '🔷' },
  [sepolia.id]: { name: 'Sepolia 测试网', icon: '🧪' },
}

/**
 * 网络下拉框的数据源
 * 由 SUPPORTED_CHAINS 自动生成，新增链时 UI 代码无需改动
 */
export const CHAIN_OPTIONS = SUPPORTED_CHAINS.map((chain) => ({
  id: chain.id,
  name: CHAIN_META[chain.id]?.name ?? chain.name,
  icon: CHAIN_META[chain.id]?.icon ?? '🌐',
}))

/**
 * 链 ID → 中文显示名（用于 UI）
 * 从 CHAIN_OPTIONS 派生，保证名称只维护一份
 */
export const CHAIN_NAMES: Record<number, string> = CHAIN_OPTIONS.reduce(
  (names, chain) => ({ ...names, [chain.id]: chain.name }),
  {} as Record<number, string>,
)

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

/**
 * 获取链的图标，未知网络 fallback
 */
export function getChainIcon(chainId: number | undefined): string {
  return CHAIN_OPTIONS.find((chain) => chain.id === chainId)?.icon ?? '🌐'
}
