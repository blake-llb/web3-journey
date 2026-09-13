# React Web3 Wallet

> 一个基于 React + wagmi + viem 的 Web3 钱包练手项目，已对接 Aave V3 实现「连接钱包 → 查询利率 → ETH 存款」完整 DeFi 流程。

[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646cff)](https://vite.dev)
[![wagmi](https://img.shields.io/badge/wagmi-3.5-000)](https://wagmi.sh)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ 功能特性

| 模块 | 说明 |
|------|------|
| 🦊 **钱包连接** | 检测 MetaMask、连接/断开、显示地址与余额 |
| 🔄 **网络切换** | 在 Ethereum 主网 ↔ Sepolia 测试网自由切换 |
| 📊 **Aave 利率查询** | 读取 Aave V3 池子中 WETH 的实时存款利率（APR） |
| 💰 **Aave 存款** | 完整三步式存款：ETH → WETH → Approve → Supply |
| 🏦 **Aave 取款** | 支持取款到 WETH（一笔）或取款到 ETH（两笔自动串联） |

## 🛠️ 技术栈

- **框架**：React 19 + Vite 7 + TypeScript 5.9
- **Web3**：wagmi 3.5 + viem 2.46
- **数据缓存**：@tanstack/react-query 5
- **合约 ABI**：Aave V3 Pool（最小可用集）
- **部署**：Vercel

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- MetaMask（或任意 EIP-1193 钱包）

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 本地预览生产版本
npm run preview

# 代码检查
npm run lint
```

启动后访问 `http://localhost:5173`。

### 准备测试网 ETH

本项目默认在 **Sepolia 测试网** 操作，需要先准备测试 ETH：

1. 切换 MetaMask 到 Sepolia 网络
2. 通过以下任一方式领取测试 ETH：
   - 官方水龙头：<https://sepoliafaucet.com>
   - PoW 挖矿：<https://sepolia-faucet.pk910.de>
   - 跨链桥：<https://testnetbridge.com>

## 📂 项目结构

```
src/
├── main.tsx                       # wagmi / react-query 初始化入口
├── App.tsx                        # 顶层组件，组合四个核心功能
├── components/
│   ├── WalletConnect.tsx          # 钱包连接 + 地址/余额展示
│   ├── AaveRate.tsx               # 读取 Aave 池子存款利率
│   ├── NewDeposit.tsx             # ETH → WETH → Approve → Supply 三步式存款
│   └── Withdraw.tsx               # Aave.withdraw → WETH/ETH（支持两步自动串联）
├── hooks/                         # 🆕 自定义 hooks 层（封装 wagmi 编排）
│   ├── useAaveSupply.ts           # 存款业务封装
│   └── useAaveWithdraw.ts         # 取款业务封装
├── config/                        # 🆕 常量配置层（集中管理地址、链等）
│   ├── chains.ts                  # 链信息 + isSepolia() 等工具函数
│   ├── aave.ts                    # Aave Pool 合约地址表
│   └── tokens.ts                  # 代币配置（symbol/decimals/addresses）
└── abis/                          # 🆕 ABI 层（避免组件里堆冗长 JSON）
    ├── aavePool.ts                # Aave Pool ABI（getReserveData + supply + withdraw）
    └── weth.ts                    # WETH9 ABI（deposit + withdraw）
```

## 📚 关键概念

### DeFi 存款的资金流

```
┌──────────┐    deposit()    ┌──────────┐    supply()    ┌──────────┐
│   ETH    │  ───────────►   │   WETH   │  ───────────►  │  aWETH   │
│ (原生币)  │   WETH9 合约    │ (ERC20)  │   Aave Pool    │ (存款凭证) │
└──────────┘                 └──────────┘                └──────────┘
   链上余额                  合约 mapping               合约 mapping
  (state)                   (balanceOf)                (balanceOf)
```

> 为什么需要 WETH？Aave 这样的 DeFi 协议 **只能调用 ERC20 接口**，不能接收原生 ETH。所以必须先把 ETH 包装成 ERC20。

### wagmi 三大配置

```typescript
createConfig({
  chains: [mainnet, sepolia],     // 1. 支持哪些链
  transports: { ... },            // 2. 怎么连这些链（HTTP / WS / fallback）
  connectors: [injected()],       // 3. 用户用什么方式登录
})
```

更多 wagmi 配置细节参考 [notes/2026-09-01.md](../notes/2026-09-01.md)。

### 合约地址速查

| 资产 | 网络 | 地址 |
|------|------|------|
| Aave V3 Pool | Mainnet | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Aave V3 Pool | Sepolia | `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951` |
| WETH9 | Mainnet | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| WETH9 | Sepolia | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

> ⚠️ 地址变更请直接修改 [`src/config/aave.ts`](src/config/aave.ts) 和 [`src/config/tokens.ts`](src/config/tokens.ts)，组件会自动适配。

## ⚙️ 配置说明

### 切换默认网络

编辑 [`src/config/chains.ts`](src/config/chains.ts) 中的 `SUPPORTED_CHAINS`：

```typescript
export const SUPPORTED_CHAINS = [mainnet, sepolia] as const
// 如需添加新链：import { base, arbitrum } from 'wagmi/chains'
// 然后 [mainnet, sepolia, base, arbitrum]
```

### 添加新的存款资产

在 [`src/config/tokens.ts`](src/config/tokens.ts) 中追加：

```typescript
export const TOKENS = {
  WETH: { /* ... */ },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,  // ⚠️ USDC 是 6 位精度，不是 18！
    addresses: {
      [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      [sepolia.id]: '0x...',
    },
  },
}
```

### 接入 WalletConnect / Coinbase

编辑 [`src/main.tsx`](src/main.tsx)：

```typescript
import { walletConnect, coinbaseWallet } from 'wagmi/connectors'

connectors: [
  injected(),
  walletConnect({ projectId: 'YOUR_PROJECT_ID' }),
  coinbaseWallet({ appName: 'React Web3 Wallet' }),
]
```

## 🐛 常见踩坑

| 问题 | 原因 / 解决方案 |
|------|--------------|
| 找不到 `deposit` 方法 | Aave **V3** 用 `supply()`，V2 才是 `deposit()`。见 [`notes/2026-08-29.md`](../notes/2026-08-29.md) |
| 查询 ABI 没有 supply/deposit | Etherscan 默认显示的是 **代理合约**，要点 "Contract → Implementation" 查看实施合约的 ABI |
| 交易失败但 ETH 没了 | gas limit 设太小导致 revert；不要手动设 gas，让钱包自动估算 |
| 查询返回数组第一个元素是 BigInt | Aave 的 `getReserveData` 返回 tuple，`currentLiquidityRate` 在索引 3 |

## 📄 License

MIT
