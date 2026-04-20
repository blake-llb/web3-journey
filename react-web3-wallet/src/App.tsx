import WalletConnect from './components/WalletConnect'
import AaveRate from './components/AaveRate'
import { DepositComponent } from './components/DepositComponent'
import './App.css'

function App() {
  return (
    <div className="app">
      <div>
        <h1>🔗 React + wagmi 钱包连接</h1>
      </div>
      <div className="app-container">
        {/* 左侧面板：钱包连接 */}
        <div className="left-panel">
          <WalletConnect />
        </div>
        {/* 右侧面板：Aave利率和存款 */}
        <div className="right-panel">
          <AaveRate />
          <DepositComponent />
        </div>
      </div>
    </div>
  )
}

export default App
