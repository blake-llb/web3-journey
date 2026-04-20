import React, { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useReadContract,
} from "wagmi";
import { formatEther, parseEther } from "viem";

// 存款合约ABI
const DEPOSIT_CONTRACT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'balances',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'address', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  }
] as const;

// 存款合约地址（替换为实际地址）
const DEPOSIT_CONTRACT_ADDRESS = '0xYourDepositContractAddress' as `0x${string}`;

export function DepositComponent() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 1、获取用户钱包ETH余额
  const {
    data: ethBalance,
    refetch: refetchEthBalance,
    isLoading: isLoadingBalance,
  } = useBalance({
    address,
  });

  // 2、获取用户在存款合约中的余额
  const {
    data: depositBalance,
    refetch: refetchDepositBalance,
    isLoading: isLoadingDeposited,
  } = useReadContract({
    address: DEPOSIT_CONTRACT_ADDRESS,
    abi: DEPOSIT_CONTRACT_ABI,
    functionName: 'balances',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && isConnected,
    },
  });

  // 3、执行存款操作
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  // 4、等待交易确认
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // 处理存款按钮点击
  const handleDeposit = async () => {
    if (!isConnected || !address) {
      alert('请先连接钱包');
      return;
    }
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('请输入有效的存款金额');
      return;
    }

    // 检查余额是否足够
    if (ethBalance && parseFloat(depositAmount) > parseFloat(formatEther(ethBalance.value))) {
      alert('余额不足');
      return;
    }

    // 调用存款合约
    setIsProcessing(true);
    try {
      await writeContract({
        address: DEPOSIT_CONTRACT_ADDRESS,
        abi: DEPOSIT_CONTRACT_ABI,
        functionName: 'deposit',
        value: parseEther(depositAmount),
      });
    } catch (error) {
      console.error('存款失败:', error);
      alert('存款失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 交易确认后刷新余额
  React.useEffect(() => {
    if (isConfirmed) {
      refetchEthBalance();
      refetchDepositBalance();
      setDepositAmount('');
      setIsProcessing(false);
      alert('存款成功！');
    }
  }, [isConfirmed, refetchEthBalance, refetchDepositBalance]);

  // 处理错误
  React.useEffect(() => {
    if (writeError || receiptError) {
      console.error('交易错误:', writeError || receiptError);
      setIsProcessing(false);
      alert('交易失败，请重试');
    }
  }, [writeError, receiptError]);

  // 未连接钱包时的显示
  if (!isConnected) {
    return (
      <div className="wallet-container">
        <div className="info-card" style={{ textAlign: 'center', padding: '40px' }}>
          <span style={{ fontSize: '48px' }}>💰</span>
          <p style={{ color: '#666', marginTop: '10px' }}>请先连接钱包</p>
        </div>
      </div>
    );
  }

  // 格式化余额显示
  const formattedEthBalance = ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000';
  const formattedDepositBalance = depositBalance ? formatEther(depositBalance) : '0';

  return (
    <div className="wallet-container">
      <div className="info-card">
        <div className="info-header">
          <span className="info-icon">💰</span>
          <h3>ETH 存款</h3>
        </div>

        {/* 余额显示 */}
        <div className="balance-info" style={{ marginBottom: '20px' }}>
          <div className="info-content">
            <span style={{ color: '#666', fontSize: '14px' }}>💵 钱包余额</span>
            {isLoadingBalance ? (
              <span className="loading-balance">加载中...</span>
            ) : (
              <span className="balance">{formattedEthBalance} ETH</span>
            )}
          </div>
          <div className="info-content" style={{ marginTop: '10px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>🏦 已存款余额</span>
            {isLoadingDeposited ? (
              <span className="loading-balance">加载中...</span>
            ) : (
              <span style={{ fontWeight: 600, color: '#10b981' }}>
                {formattedDepositBalance} ETH
              </span>
            )}
          </div>
        </div>

        {/* 存款输入 */}
        <div className="deposit-input" style={{ marginTop: '20px' }}>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="输入存款金额 (ETH)"
            min="0"
            step="0.001"
            disabled={isProcessing}
            className="address"
            style={{ 
              flex: 1, 
              marginRight: '10px',
              fontSize: '16px',
              padding: '12px'
            }}
          />
          <button
            onClick={handleDeposit}
            className="connect-button"
            disabled={
              !depositAmount || 
              isProcessing || 
              isWritePending || 
              isConfirming ||
              !writeContract
            }
            style={{ 
              maxWidth: '120px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            }}
          >
            {getButtonText()}
          </button>
        </div>

        {/* 状态显示 */}
        {isWritePending && (
          <p style={{ color: '#1976d2', marginTop: '15px' }}>⏳ 请检查钱包并确认交易...</p>
        )}
        {isConfirming && (
          <p style={{ color: '#1976d2', marginTop: '15px' }}>🔄 交易确认中... 哈希: {hash?.slice(0, 10)}...</p>
        )}
        {isConfirmed && (
          <p style={{ color: '#10b981', marginTop: '15px', fontWeight: 600 }}>✓ 存款成功！</p>
        )}
        
        {/* 交易哈希链接 */}
        {hash && (
          <p style={{ marginTop: '15px' }}>
            <a 
              href={`https://etherscan.io/tx/${hash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#1976d2', textDecoration: 'underline' }}
            >
              🔗 查看交易详情
            </a>
          </p>
        )}
      </div>
    </div>
  );

  function getButtonText() {
    if (!writeContract) return '未就绪';
    if (isWritePending) return '确认...';
    if (isConfirming) return '确认中';
    if (isProcessing) return '处理中';
    return '存款';
  }
}
