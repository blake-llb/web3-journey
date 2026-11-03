import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { SUPPORTED_CHAINS, CHAIN_IDS } from './config/chains'
import App from './App.tsx'
import './index.css'

/**
 * RPC 节点
 *
 * viem 内置的默认节点（主网 eth.merkle.io）在部分网络会被限流/返回 Cloudflare 错误，
 * 浏览器里表现为 CORS / Failed to fetch。这里显式配置公共节点，
 * 并支持用 .env 覆盖（见 .env.example）。
 */
const MAINNET_RPC_URL =
  import.meta.env.VITE_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com'
const SEPOLIA_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

// 创建查询客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 减少缓存时间，避免旧数据
      staleTime: 5000,
      gcTime: 10000,
    },
  },
})

// 创建 wagmi 配置
const config = createConfig({
  // 链列表集中维护在 config/chains.ts
  chains: SUPPORTED_CHAINS,
  transports: {
    [CHAIN_IDS.mainnet]: http(MAINNET_RPC_URL),
    [CHAIN_IDS.sepolia]: http(SEPOLIA_RPC_URL),
  },
  connectors: [
    injected(),
  ],
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)