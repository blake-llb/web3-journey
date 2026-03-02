<template>
  <div class="simple-wallet">
    <div v-if="!isConnected" class="connect-section">
      <div class="connect-icon">🦊</div>
      <h2>连接 MetaMask 钱包</h2>
      <p>点击下方按钮连接您的钱包</p>

      <button
        class="connect-button"
        :disabled="isConnecting"
        @click="connectWallet">
        <span v-if="!isConnecting">连接钱包</span>
        <span v-else>正在连接...</span>
      </button>

      <div v-if="error" class="error-message">
        ❌ {{ error.message }}
      </div>

      <div v-if="!hasMetaMask" class="install-guide">
        <p>未检测到 MetaMask，请先安装：</p>
        <a href="https://metamask.io" target="_blank" class="install-link">
          🌐 前往 MetaMask 官网安装
        </a>
      </div>
    </div>

    <div v-else class="connected-section">
      <div class="success-header">
        <div class="success-icon">✅</div>
        <h2>钱包已连接</h2>
      </div>

      <!-- 地址信息 -->
      <div class="info-card">
        <div class="info-header">
          <span class="info-icon">👤</span>
          <h3>钱包地址</h3>
        </div>
        <div class="info-content">
          <code class="address">{{ formattedAddress }}</code>
          <button @click="copyAddress" class="copy-button" title="复制地址">
            📋
          </button>
        </div>
        <p class="full-address">{{ address }}</p>
      </div>

      <!-- 余额信息 -->
      <div class="info-card">
        <div class="info-header">
          <span class="info-icon">💰</span>
          <h3>ETH 余额</h3>
        </div>
        <div class="info-content">
          <div v-if="isBalanceLoading" class="loading-balance">
            🔄 加载中...
          </div>
          <div v-else class="balance-display">
            <span class="balance">{{ formattedBalance }}</span>
            <span class="currency">ETH</span>
          </div>
          <button 
            @click="refreshBalance" 
            class="refresh-button"
            :disabled="isBalanceLoading"
            title="刷新余额"
          >
            🔄
          </button>
        </div>
      </div>

      <!-- 断开连接按钮 -->
      <button @click="disconnectWallet" class="disconnect-button">
        🚪 断开连接
      </button>
    </div>
  </div>
</template>
<script>
import { ref, computed, onMounted } from 'vue'
import { useAccount, useConnect, useDisconnect, useBalance, useConfig } from 'use-wagmi'
import { injected } from 'use-wagmi/connectors'

// 使用 wagmi hooks
const { address, isConnected } = useAccount()
const { connect } = useConnect()
const { disconnect } = useDisconnect()
const { data: balance } = useBalance({
  address: address,
})

// 状态
const hasMetaMask = ref(false)

// 计算属性
const formattedAddress = computed(() => {
  if (!address.value) return ''
  const addr = address.value
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
})

const formattedBalance = computed(() => {
  if (!balanceData.value) return '0.0000'
  // 将 wei 转换为 ETH (1 ETH = 10^18 wei)
  const balance = Number(balanceData.value.value) / 1e18
  return balance.toFixed(4)
})

// 连接方法
const connectWallet = async () => {
  try {
    await connect({ connector: injected() })
  } catch (err) {
    console.error('连接失败:', err)
  }
}

const disconnectWallet = () => {
  disconnect()
}

const copyAddress = async () => {
  if (!address.value) return
  try {
    await navigator.clipboard.writeText(address.value)
    alert('地址已复制到剪贴板！')
  } catch (err) {
    console.error('复制失败:', err)
  }
}

const refreshBalance = () => {
  refetch()
}

// 生命周期
onMounted(() => {
  // 尝试获取配置
  try {
    const config = useConfig()
    console.log('成功获取配置:', config)
  } catch (err) {
    console.error('获取配置失败:', err)
  }
  // 检测是否安装了 MetaMask
  hasMetaMask.value = !!window.ethereum
  
  // 如果有 MetaMask，监听账户变化
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        // 用户断开连接
        disconnect()
      }
    })
  }
})
</script>
<style scoped>
.simple-wallet {
  padding: 20px;
}

/* 未连接状态样式 */
.connect-section {
  text-align: center;
  padding: 30px 0;
}

.connect-icon {
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.8;
}

.connect-section h2 {
  font-size: 28px;
  color: #333;
  margin-bottom: 10px;
}

.connect-section p {
  color: #666;
  margin-bottom: 30px;
  font-size: 16px;
}

.connect-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 40px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 20px;
  transition: all 0.3s ease;
  width: 100%;
  max-width: 300px;
}

.connect-button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.connect-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 12px 20px;
  border-radius: 8px;
  margin: 20px 0;
  font-size: 14px;
  border-left: 4px solid #c62828;
}

.install-guide {
  background: #e3f2fd;
  padding: 20px;
  border-radius: 12px;
  margin-top: 30px;
}

.install-guide p {
  color: #1976d2;
  margin-bottom: 10px;
  font-weight: 500;
}

.install-link {
  display: inline-block;
  background: #1976d2;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  transition: background 0.3s;
}

.install-link:hover {
  background: #1565c0;
}

/* 已连接状态样式 */
.connected-section {
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.success-header {
  text-align: center;
  margin-bottom: 30px;
}

.success-icon {
  font-size: 60px;
  margin-bottom: 10px;
}

.success-header h2 {
  color: #2e7d32;
  font-size: 24px;
}

.info-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.info-icon {
  font-size: 20px;
}

.info-header h3 {
  color: #495057;
  font-size: 18px;
  margin: 0;
}

.info-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.address {
  font-family: 'Courier New', monospace;
  font-size: 20px;
  font-weight: 600;
  color: #333;
  background: white;
  padding: 10px 15px;
  border-radius: 8px;
  flex: 1;
  margin-right: 10px;
}

.copy-button {
  background: #6c757d;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.3s;
}

.copy-button:hover {
  background: #545b62;
}

.full-address {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #868e96;
  word-break: break-all;
  margin-top: 10px;
  background: white;
  padding: 10px;
  border-radius: 6px;
}

.balance-display {
  display: flex;
  align-items: baseline;
  flex: 1;
}

.balance {
  font-size: 32px;
  font-weight: 700;
  color: #10b981;
  margin-right: 10px;
}

.currency {
  font-size: 20px;
  color: #6b7280;
}

.loading-balance {
  font-size: 18px;
  color: #6b7280;
  font-style: italic;
  flex: 1;
}

.refresh-button {
  background: #10b981;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.3s;
}

.refresh-button:hover:not(:disabled) {
  background: #0da271;
}

.refresh-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.disconnect-button {
  background: #ef4444;
  color: white;
  border: none;
  padding: 16px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 20px;
  transition: background 0.3s;
}

.disconnect-button:hover {
  background: #dc2626;
}
</style>