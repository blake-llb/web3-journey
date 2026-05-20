import WalletConnect from './components/WalletConnect'
import AaveRate from './components/AaveRate'
import DepositComponent from './components/DepositComponent'
import './App.css'

function App() {
  return (
    <div className="app">
      <div className="app-container">
        <div className="main-panel">
          <WalletConnect />
          <AaveRate />
          <DepositComponent />
        </div>
      </div>
    </div>
  )
}

export default App