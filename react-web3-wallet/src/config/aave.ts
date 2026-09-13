import type { Address } from 'viem'
import { mainnet, sepolia } from 'wagmi/chains'

/**
 * Aave V3 Pool 合约地址（按链 ID 索引）
 * 来源：Aave 官方文档 https://docs.aave.com/developers/deployed-contracts/v3-mainnet
 */
export const AAVE_POOL_ADDRESSES: Record<number, Address> = {
  [mainnet.id]: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  [sepolia.id]: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
}

/**
 * 获取当前链的 Aave Pool 地址
 * 找不到时 fallback 到 Sepolia（开发期间默认走测试网）
 */
export function getAavePoolAddress(chainId: number | undefined): Address {
  if (chainId === undefined) return AAVE_POOL_ADDRESSES[sepolia.id]
  return AAVE_POOL_ADDRESSES[chainId] ?? AAVE_POOL_ADDRESSES[sepolia.id]
}
