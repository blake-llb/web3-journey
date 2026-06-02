import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useChainId,
} from "wagmi";
import { 
  formatUnits, 
  parseUnits, 
  parseGwei,
  erc20Abi
} from "viem";
import PoolArtifact from '@aave/core-v3/artifacts/contracts/protocol/pool/Pool.sol/Pool.json';

// ================ 配置常量 ================
// Aave V3 Pool 合约地址 (Sepolia 测试网)
const AAVE_V3_POOL_ADDRESS = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951" as const;

// Sepolia 测试网代币地址
const TOKEN_ADDRESSES = {
  WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c" as const,
  USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8" as const,
  DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357" as const,
} as const;

// 支持的代币列表
const SUPPORTED_TOKENS = [
  { symbol: "WETH", address: TOKEN_ADDRESSES.WETH, decimals: 18 },
  { symbol: "USDC", address: TOKEN_ADDRESSES.USDC, decimals: 6 },
  { symbol: "DAI", address: TOKEN_ADDRESSES.DAI, decimals: 18 },
];

// 网络特定的 Gas 配置
const NETWORK_GAS_CONFIG = {
  sepolia: {
    gasLimit: 300000n,
    maxFeePerGas: parseGwei("25"),
    maxPriorityFeePerGas: parseGwei("1.5"),
  },
  mainnet: {
    gasLimit: 400000n,
    maxFeePerGas: parseGwei("30"),
    maxPriorityFeePerGas: parseGwei("2"),
  },
};

// ================ 类型定义 ================

interface TransactionState {
  isProcessing: boolean;
  isApproving: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: string | null;
  txHash: `0x${string}` | null;
}
interface UserReserveData {
  currentATokenBalance: bigint;
  currentStableDebt: bigint;
  currentVariableDebt: bigint;
  principalStableDebt: bigint;
  scaledVariableDebt: bigint;
  stableBorrowRate: bigint;
  liquidityRate: bigint;
  stableRateLastUpdated: number;
  usageAsCollateralEnabled: boolean;
}


// ================ 主组件 ================
export default function AaveV3Deposit() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // 状态管理
  const [depositAmount, setDepositAmount] = useState<string>("0.01");
  const [selectedToken, setSelectedToken] = useState<typeof SUPPORTED_TOKENS[0]>(SUPPORTED_TOKENS[0]);
  const [transaction, setTransaction] = useState<TransactionState>({
    isProcessing: false,
    isApproving: false,
    isConfirming: false,
    isConfirmed: false,
    error: null,
    txHash: null,
  });
  const [userAllowance, setUserAllowance] = useState<bigint>(0n);
  // Aave存款额度
   const [aaveBalance, setAaveBalance] = useState<bigint>(0n);

  // ================ Hook 调用 ================
  // 1. 获取用户Aave存款余额 (针对当前选中的代币)
  // const { data: reserveData, refetch: refetchReserveData, error: reserveError } = useReadContract({
  //   address: AAVE_V3_POOL_ADDRESS,
  //   abi: PoolArtifact.abi,
  //   functionName: 'getUserReserveData',
  //   args: [selectedToken.address, address],
  //   query: {
  //     enabled: !!address && isConnected,
  //   }
  // });

  // // 更新 aaveBalance
  // useEffect(() => {
  //   console.log("Reserve Data:", reserveData);
  //   console.log("Reserve Error:", reserveError);
  //   if (reserveData) {
  //     try {
  //       // 如果是元组，第一个元素通常是currentATokenBalance
  //       if (Array.isArray(reserveData)) {
  //         const balance = reserveData[0] as bigint;
  //         setAaveBalance(balance);
  //         console.log("Aave余额（元组）:", balance.toString());
  //       } 
  //       // 如果返回的是对象
  //       else if (typeof reserveData === 'object' && reserveData !== null) {
  //         const data = reserveData as UserReserveData;
  //         setAaveBalance(data.currentATokenBalance);
  //         console.log("Aave余额（对象）:", data.currentATokenBalance.toString());
  //       }
  //     } catch (error) {
  //       console.error("解析reserveData失败:", error);
  //       setAaveBalance(0n);
  //     }
  //   } else {
  //     setAaveBalance(0n);
  //   }
  // }, [reserveData, reserveError]);
  // 1. 首先获取aToken地址
const { 
  data: reserveData, 
  refetch: refetchReserveData,
  error: reserveError,
  isLoading: isLoadingReserveData
} = useReadContract({
  address: AAVE_V3_POOL_ADDRESS,
  abi: [
    {
      "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
      "name": "getReserveData",
      "outputs": [
        {"internalType": "DataTypes.ReserveConfigurationMap", "name": "configuration", "type": "uint256"},
        {"internalType": "uint128", "name": "liquidityIndex", "type": "uint128"},
        {"internalType": "uint128", "name": "currentLiquidityRate", "type": "uint128"},
        {"internalType": "uint128", "name": "variableBorrowIndex", "type": "uint128"},
        {"internalType": "uint128", "name": "currentVariableBorrowRate", "type": "uint128"},
        {"internalType": "uint128", "name": "currentStableBorrowRate", "type": "uint128"},
        {"internalType": "uint40", "name": "lastUpdateTimestamp", "type": "uint40"},
        {"internalType": "uint16", "name": "id", "type": "uint16"},
        {"internalType": "address", "name": "aTokenAddress", "type": "address"},
        {"internalType": "address", "name": "stableDebtTokenAddress", "type": "address"},
        {"internalType": "address", "name": "variableDebtTokenAddress", "type": "address"},
        {"internalType": "address", "name": "interestRateStrategyAddress", "type": "address"},
        {"internalType": "uint128", "name": "accruedToTreasury", "type": "uint128"},
        {"internalType": "uint128", "name": "unbacked", "type": "uint128"},
        {"internalType": "uint128", "name": "isolationModeTotalDebt", "type": "uint128"}
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  functionName: 'getReserveData',
  args: [selectedToken.address],
  query: {
    enabled: !!selectedToken.address,
  }
});

// 2. 获取aToken地址并查询余额
const aTokenAddress = reserveData?.[8]; // aTokenAddress是第9个元素（索引8）

const { 
  data: aTokenBalance,
  refetch: refetchATokenBalance,
} = useReadContract({
  address: aTokenAddress as `0x${string}` | undefined,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: address ? [address] : undefined,
  query: {
    enabled: !!aTokenAddress && !!address,
  }
});

// 3. 更新Aave余额
useEffect(() => {
  console.log("=== 调试信息 ===");
  console.log("aToken地址:", aTokenAddress);
  console.log("aToken余额:", aTokenBalance?.toString());
  
  if (aTokenBalance !== undefined) {
    setAaveBalance(aTokenBalance);
  } else {
    setAaveBalance(0n);
  }
}, [aTokenBalance, aTokenAddress]);

  // 2. 获取用户选择的代币余额
  const { 
    data: tokenBalanceRaw,
    refetch: refetchTokenBalance 
  } = useReadContract({
    address: selectedToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address && isConnected },
  });

  // 3. 检查用户对Aave Pool的授权额度
  const { 
    data: allowance, 
    refetch: refetchAllowance 
  } = useReadContract({
    address: selectedToken.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, AAVE_V3_POOL_ADDRESS],
    query: { enabled: !!address && isConnected },
  });

  // 4. 写入合约（用于授权和存款）
  const { 
    writeContractAsync: writeContract,
    error: writeError,
  } = useWriteContract();

  // 6. 等待交易确认
  const { 
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: transaction.txHash ?? undefined,
  });

  // ================ 计算属性 ================
  const currentGasConfig = chainId === 11155111 
    ? NETWORK_GAS_CONFIG.sepolia 
    : NETWORK_GAS_CONFIG.mainnet;

  // 解析用户输入的存款金额为最小单位（如wei）
  const parsedDepositAmount = depositAmount 
    ? parseUnits(depositAmount, selectedToken.decimals)
    : 0n;

  const isApproved = userAllowance >= parsedDepositAmount && parsedDepositAmount > 0n;
  // 检查用户代币余额是否充足，如果不为0需要检查输入金额和代币余额的关系
  const hasInsufficientBalance = tokenBalanceRaw 
    ? tokenBalanceRaw < parsedDepositAmount
    : false;

  // 格式化代币余额
  const formattedTokenBalance = tokenBalanceRaw
    ? formatUnits(tokenBalanceRaw, selectedToken.decimals)
    : "0";
    
  // 格式化 Aave 存款余额
  const formattedAaveBalance = formatUnits(aaveBalance, selectedToken.decimals);

  const formattedAllowance = userAllowance
    ? formatUnits(userAllowance, selectedToken.decimals)
    : "0";

  // ================ 副作用 ================
  // 更新授权额度
  useEffect(() => {
    if (allowance !== undefined) {
      setUserAllowance(allowance as bigint);
    }
  }, [allowance]);

  // 监听交易确认状态
  useEffect(() => {
    if (isConfirmed && receipt) {
      setTransaction(prev => ({
        ...prev,
        isConfirmed: true,
        isProcessing: false,
        isConfirming: false,
      }));
      
      // 刷新余额、授权和 Aave 储备数据
      setTimeout(() => {
        refetchTokenBalance();
        refetchAllowance();
        refetchReserveData();
      }, 2000);
    }
  }, [isConfirmed, receipt, refetchTokenBalance, refetchAllowance, refetchReserveData]);

    // 调试：打印数据
  useEffect(() => {
    console.log("当前代币:", selectedToken);
    console.log("代币余额:", tokenBalanceRaw?.toString());
    console.log("Aave余额:", aaveBalance?.toString());
    console.log("授权额度:", userAllowance?.toString());
  }, [selectedToken, tokenBalanceRaw, aaveBalance, userAllowance]);

  // 监听写入错误
  useEffect(() => {
    if (writeError) {
      setTransaction(prev => ({
        ...prev,
        error: writeError.message,
        isProcessing: false,
        isApproving: false,
      }));
    }
  }, [writeError]);

  // 监听确认状态
  useEffect(() => {
    setTransaction(prev => ({
      ...prev,
      isConfirming,
    }));
  }, [isConfirming]);

  // ================ 工具函数 ================
  const getGasConfig = useCallback(() => {
    // 对于 Sepolia 测试网，使用更保守的 Gas 设置
    if (chainId === 11155111) {
      return {
        gas: 250000n, // 降低 gas limit
        maxFeePerGas: parseGwei("20"),
        maxPriorityFeePerGas: parseGwei("1"),
      };
    }
    return currentGasConfig;
  }, [chainId, currentGasConfig]);

  const formatError = (error: unknown): string => {
    if (!error) return "未知错误";
    
    const err = error as { message?: string };
    const message = err.message || String(error);
    
    if (message.includes("gas limit too high")) {
      return "Gas 限制过高，请尝试减少存款金额";
    }
    if (message.includes("insufficient funds")) {
      return "余额不足，请检查代币余额和ETH余额（Gas费）";
    }
    if (message.includes("user rejected")) {
      return "用户拒绝了交易";
    }
    if (message.includes("execution reverted")) {
      return "交易执行失败，请检查参数";
    }
    
    return message.length > 100 ? message.substring(0, 100) + "..." : message;
  };

  // ================ 业务逻辑 ================
  const handleApprove = async () => {
    if (!address || !depositAmount || parsedDepositAmount === 0n) {
      setTransaction(prev => ({ ...prev, error: "请输入有效的存款金额" }));
      return;
    }

    setTransaction(prev => ({ 
      ...prev, 
      isProcessing: true, 
      isApproving: true, 
      error: null 
    }));

    try {
      const gasConfig = getGasConfig();
      
      const hash = await writeContract({
        address: selectedToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [AAVE_V3_POOL_ADDRESS, parsedDepositAmount],
        ...gasConfig,
      });

      setTransaction(prev => ({ ...prev, txHash: hash }));
    } catch (error) {
      console.error("授权失败:", error);
      setTransaction(prev => ({ 
        ...prev, 
        error: formatError(error),
        isProcessing: false,
        isApproving: false,
      }));
    }
  };

  // 存款逻辑
  const handleDeposit = async () => {
    if (!address || !depositAmount || parsedDepositAmount === 0n) {
      setTransaction(prev => ({ ...prev, error: "请输入有效的存款金额" }));
      return;
    }

    if (hasInsufficientBalance) {
      setTransaction(prev => ({ ...prev, error: "代币余额不足" }));
      return;
    }

    setTransaction(prev => ({ 
      ...prev, 
      isProcessing: true, 
      isApproving: false, 
      error: null 
    }));

    try {
      const gasConfig = getGasConfig();
      
      // 注意：Aave V3 的 supply 函数不需要 value 参数
      const hash = await writeContract({
        address: AAVE_V3_POOL_ADDRESS,
        abi: PoolArtifact.abi,
        functionName: "supply",
        args: [
          selectedToken.address,  // asset
          parsedDepositAmount,    // amount
          address,               // onBehalfOf
          0                      // referralCode
        ],
        ...gasConfig,
      });

      setTransaction(prev => ({ ...prev, txHash: hash }));
    } catch (error) {
      console.error("存款失败:", error);
      setTransaction(prev => ({ 
        ...prev, 
        error: formatError(error),
        isProcessing: false,
      }));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleWithdraw = async () => {
    console.log("取款功能待实现");
  };

  const handleTokenChange = (tokenSymbol: string) => {
    const token = SUPPORTED_TOKENS.find(t => t.symbol === tokenSymbol);
    if (token) {
      setSelectedToken(token);
      setDepositAmount("0.01"); // 重置金额
      // 切换代币时，Aave 余额会自动通过 useReadContract 重新获取
    }
  };

  const getButtonState = () => {
    if (!isConnected) return { text: "请连接钱包", disabled: true };
    if (!depositAmount || parseFloat(depositAmount) <= 0) return { text: "输入金额", disabled: true };
    if (hasInsufficientBalance) return { text: "余额不足", disabled: true };
    if (transaction.isProcessing) return { text: "处理中...", disabled: true };
    if (!isApproved) return { text: "授权代币", disabled: false };
    return { text: "存入 Aave", disabled: false };
  };

  // ================ 渲染逻辑 ================
  if (!isConnected) {
    return (
      <div className="wallet-not-connected">
        <div className="info-card">
          <span className="icon-large">🔌</span>
          <h3>连接钱包</h3>
          <p>请先连接您的钱包以使用存款功能</p>
        </div>
      </div>
    );
  }

  const buttonState = getButtonState();

  return (
    <div className="aave-deposit-container">
      <div className="deposit-card">
        <div className="card-header">
          <span className="card-icon">🏦</span>
          <h3>Aave V3 存款</h3>
          <span className="network-badge">
            {chainId === 11155111 ? "Sepolia" : "Mainnet"}
          </span>
        </div>

        {/* 代币选择 */}
        <div className="token-selector">
          <label>选择存款代币</label>
          <select
            value={selectedToken.symbol}
            onChange={(e) => handleTokenChange(e.target.value)}
            className="token-select"
          >
            {SUPPORTED_TOKENS.map(token => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* 余额信息 */}
        <div className="balance-info">
          <div className="balance-item">
            <span className="balance-label">💰 钱包代币余额</span>
            <span className="balance-value">{formattedTokenBalance} {selectedToken.symbol}</span>
          </div>
          <div className="balance-item">
            <span className="balance-label">⛽ Aave存款金余额</span>
            <span className="balance-value">
              {formattedAaveBalance} {selectedToken.symbol}
            </span>
          </div>
          <div className="balance-item">
            <span className="balance-label">🏦 已授权Aave额度</span>
            <span className="balance-value">
              {formattedAllowance} {selectedToken.symbol}
            </span>
          </div>
        </div>

        {/* 存款输入 */}
        <div className="deposit-input-group">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => {
              const value = e.target.value;
              // 限制测试网最大金额
              if (chainId === 11155111 && parseFloat(value) > 10) {
                alert("测试网建议最大金额为 10");
                setDepositAmount("10");
              } else {
                setDepositAmount(value);
              }
            }}
            placeholder="输入存款金额"
            min="0"
            max={chainId === 11155111 ? "10" : undefined}
            step="0.001"
            disabled={transaction.isProcessing}
            className="amount-input"
          />
          <span className="token-symbol">{selectedToken.symbol}</span>
        </div>

        {/* 授权状态提示 */}
        {!isApproved && parsedDepositAmount > 0n && (
          <div className="approval-hint">
            ℹ️ 首次使用需要授权 Aave 合约使用您的 {selectedToken.symbol}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="action-buttons">
          {!isApproved ? (
            <button
              onClick={handleApprove}
              disabled={buttonState.disabled || transaction.isApproving}
              className={`action-button ${transaction.isApproving ? 'loading' : 'approve'}`}
            >
              {transaction.isApproving ? "授权中..." : "授权代币"}
            </button>
          ) : (
            <button
              onClick={handleDeposit}
              disabled={buttonState.disabled || transaction.isProcessing}
              className={`action-button ${transaction.isProcessing ? 'loading' : 'deposit'}`}
            >
              {transaction.isProcessing ? "存款中..." : buttonState.text}
            </button>
          )}
        </div>

        {/* 状态指示器 */}
        <div className="status-indicator">
          {transaction.isConfirming && (
            <div className="status-item confirming">
              <span className="status-icon">⏳</span>
              <span>交易确认中...</span>
            </div>
          )}
          
          {transaction.isConfirmed && (
            <div className="status-item success">
              <span className="status-icon">✅</span>
              <span>存款成功！</span>
            </div>
          )}
          
          {transaction.error && (
            <div className="status-item error">
              <span className="status-icon">❌</span>
              <span>{transaction.error}</span>
            </div>
          )}
        </div>

        {/* 交易信息 */}
        {transaction.txHash && (
          <div className="transaction-info">
            <a
              href={`https://sepolia.etherscan.io/tx/${transaction.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              🔗 查看交易详情
            </a>
            <div className="tx-hash">
              {transaction.txHash.slice(0, 10)}...{transaction.txHash.slice(-8)}
            </div>
          </div>
        )}

        {/* Gas 信息提示 */}
        {chainId === 11155111 && (
          <div className="gas-info">
            <small>
              💡 Sepolia 测试网建议：使用小金额（≤0.1 ETH），避免 Gas 过高错误
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

// ================ CSS 样式 ================
const styles = `
.aave-deposit-container {
  max-width: 480px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.wallet-not-connected {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.info-card, .deposit-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f3f5;
}

.card-icon {
  font-size: 28px;
}

.card-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #212529;
  flex-grow: 1;
}

.network-badge {
  background: #e7f5ff;
  color: #1971c2;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.token-selector {
  margin-bottom: 20px;
}

.token-selector label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #495057;
  font-weight: 500;
}

.token-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 16px;
  background: white;
  transition: border-color 0.2s;
}

.token-select:focus {
  outline: none;
  border-color: #339af0;
  box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1);
}

.balance-info {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.balance-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.balance-item:not(:last-child) {
  border-bottom: 1px solid #e9ecef;
}

.balance-label {
  color: #6c757d;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.balance-value {
  font-weight: 600;
  color: #212529;
  font-size: 15px;
}

.deposit-input-group {
  position: relative;
  margin-bottom: 20px;
}

.amount-input {
  width: 100%;
  padding: 16px 100px 16px 16px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  font-size: 18px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.amount-input:focus {
  outline: none;
  border-color: #339af0;
  box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1);
}

.amount-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.token-symbol {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: #e9ecef;
  padding: 4px 12px;
  border-radius: 8px;
  font-weight: 500;
  color: #495057;
}

.approval-hint {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  font-size: 14px;
  color: #856404;
  text-align: center;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.action-button {
  flex: 1;
  padding: 16px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 52px;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button.approve {
  background: linear-gradient(135deg, #ffd43b 0%, #fab005 100%);
  color: #212529;
}

.action-button.deposit {
  background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
  color: white;
}

.action-button.loading {
  background: #adb5bd;
  color: white;
}

.status-indicator {
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.status-item.confirming {
  background: #e7f5ff;
  color: #1971c2;
  border: 1px solid #a5d8ff;
}

.status-item.success {
  background: #d3f9d8;
  color: #2b8a3e;
  border: 1px solid #b2f2bb;
}

.status-item.error {
  background: #ffe3e3;
  color: #c92a2a;
  border: 1px solid #ffa8a8;
}

.transaction-info {
  text-align: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 16px;
}

.tx-link {
  display: inline-block;
  color: #1971c2;
  text-decoration: none;
  font-weight: 500;
  margin-bottom: 8px;
  transition: color 0.2s;
}

.tx-link:hover {
  color: #1864ab;
  text-decoration: underline;
}

.tx-hash {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #6c757d;
  word-break: break-all;
}

.gas-info {
  text-align: center;
  color: #6c757d;
  font-size: 12px;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}

.icon-large {
  font-size: 48px;
  display: block;
  text-align: center;
  margin-bottom: 16px;
}
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = styles;
  document.head.appendChild(styleEl);
}