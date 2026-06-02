import WalletConnect from './components/WalletConnect'
import AaveRate from './components/AaveRate'
import NewDeposit from './components/NewDeposit'
import './App.css'

function App() {
  return (
    <div className="app">
      <div className="app-container">
        <div className="main-panel">
          <WalletConnect />
          <AaveRate />
          <NewDeposit />
        </div>
      </div>
    </div>
  )
}

export default App