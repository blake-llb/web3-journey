import React, { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { formatEther } from 'viem'
import AaveRate from './AaveRate'

const WalletConnect: React.FC = () => {
  const { address, isConnected } = useAccount()
  const { connect, connectors, error, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance, isLoading: isBalanceLoading, refetch } = useBalance({ address })
  
  const [hasMetaMask, setHasMetaMask] = useState(false)
  const [showFullAddress, setShowFullAddress] = useState(false)

  // 检测是否安装 MetaMask
  useEffect(() => {
    setHasMetaMask(!!(window as any).ethereum)
  }, [])

  // 格式化地址
  const formattedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

  // const renderCount = useRef(0)
  // useEffect(() => { 
  //   renderCount.current += 1
  //   console.log('总渲染次数', renderCount.current)
  // })
  // console.log('执行了多少次')
  // console.log('balance:', balance)
  // 格式化余额
  const formattedBalance = balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '0.0000'

  // 复制地址
  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      alert('✅ 地址已复制到剪贴板！')
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 连接钱包
  const handleConnect = () => {
    const injectedConnector = connectors.find(connector => connector.id === 'injected')
    if (injectedConnector) {
      connect({ connector: injectedConnector })
    }
  }

  if (!isConnected) {
    return (
      <div className="wallet-container">
        <div className="connect-section">
          <div className="connect-icon">🦊</div>
          <h2>连接 MetaMask 钱包</h2>
          <p>点击下方按钮连接您的钱包</p>
          
          <button 
            onClick={handleConnect}
            className="connect-button"
            disabled={isPending || !hasMetaMask}
          >
            {isPending ? '⏳ 连接中...' : '🔗 连接钱包'}
          </button>
          
          {error && (
            <div className="error-message">
              ❌ {error.message}
            </div>
          )}
          
          {!hasMetaMask && (
            <div className="install-guide">
              <p>未检测到 MetaMask，请先安装：</p>
              <a 
                href="https://metamask.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="install-button"
              >
                🌐 安装 MetaMask
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="wallet-container">
      <div className="connected-section">
        <div className="success-header">
          <div className="success-icon">✅</div>
          <h2>钱包已连接</h2>
        </div>
        
        {/* 地址信息 */}
        <div className="info-card">
          <div className="info-header">
            <span className="info-icon">👤</span>
            <h3>钱包地址</h3>
          </div>
          <div className="info-content">
            {
              showFullAddress ? (
                <code className="address">{address}</code>
              ) : (
                <code className="address">{formattedAddress}</code>
              )
            }
            <button 
              onClick={copyAddress} 
              className="action-button" 
              title="复制地址"
            >
              📋
            </button>
          </div>
          <button
            onClick={() => setShowFullAddress(!showFullAddress)} 
            className="toggle-button"
          >
            {showFullAddress ? '收起完整地址' : '显示完整地址'}
          </button>
        </div>
        
        {/* 余额信息 */}
        <div className="info-card">
          <div className="info-header">
            <span className="info-icon">💰</span>
            <h3>ETH 余额</h3>
          </div>
          <div className="info-content">
            {isBalanceLoading ? (
              <div className="loading-balance">⏳ 加载中...</div>
            ) : (
              <div className="balance-display">
                <span className="balance">{formattedBalance}</span>
                <span className="currency">ETH</span>
              </div>
            )}
            <button 
              onClick={() => refetch()}
              className="action-button"
              disabled={isBalanceLoading}
              title="刷新余额"
            >
              🔄
            </button>
          </div>
        </div>

        {/* aave存款利率 */}
        <AaveRate />
        
        {/* 断开连接按钮 */}
        <button onClick={() => disconnect()} className="disconnect-button">
          🚪 断开连接
        </button>
      </div>
    </div>
  )
}

export default WalletConnect