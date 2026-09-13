import { useState } from 'react'
import WalletConnect from './components/WalletConnect'
import AaveRate from './components/AaveRate'
import NewDeposit from './components/NewDeposit'
import Withdraw from './components/Withdraw'
import OperationPanel from './components/OperationPanel'
import Modal from './components/Modal'
import './App.css'

/**
 * 主页面布局：
 *
 *   ┌────────────────┬───────────────┐
 *   │  钱包 + Aave 利率 │    操作面板    │
 *   │  ─────────────  │  ───────────  │
 *   │  地址           │  网络          │
 *   │  余额           │  [测试][主网] │
 *   │  利率           │  ───────────  │
 *   │                │  操作          │
 *   │                │  [存款][取款] │
 *   │                │  ───────────  │
 *   │                │  账户          │
 *   │                │  [断开连接]   │
 *   └────────────────┴───────────────┘
 *
 * 左侧：钱包连接组件 + Aave 利率组件 组合在一个卡片里，
 *      整体更协调，左卡片稍宽以容纳地址和利率显示。
 * 右侧：操作面板（含网络切换、业务按钮、断开连接），
 *      收窄到合理宽度，整体一屏可见。
 */
function App() {
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  return (
    <div className="app">
      <div className="app-container">
        <div className="main-panel">
          {/* 左侧：钱包 + Aave 利率 组合卡片 */}
          <div className="wallet-card">
            <WalletConnect />
            <AaveRate />
          </div>

          {/* 右侧：操作面板（含断开连接） */}
          <OperationPanel
            onDeposit={() => setDepositOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
          />
        </div>
      </div>

      {/* 存款弹窗 —— 仅在打开时挂载子组件，避免缓存陈旧数据 */}
      <Modal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        title="存款到 Aave"
        subtitle="将 ETH 存入 Aave V3 开始赚取存款利息"
      >
        {depositOpen && <NewDeposit />}
      </Modal>

      {/* 取款弹窗 —— 仅在打开时挂载子组件 */}
      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="从 Aave 取款"
        subtitle="从 Aave V3 提取存款，可取到 WETH 或直接换回 ETH"
      >
        {withdrawOpen && <Withdraw />}
      </Modal>
    </div>
  )
}

export default App
