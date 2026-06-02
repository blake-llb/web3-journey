import { useState, useEffect, useRef } from "react";
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
const AAVE_V3_POOL_ADDRESS = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951" as const;

const TOKEN_ADDRESSES = {
  WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c" as const,
  USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8" as const,
  DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357" as const,
} as const;

const SUPPORTED_TOKENS = [
  { symbol: "WETH", address: TOKEN_ADDRESSES.WETH, decimals: 18 },
  { symbol: "USDC", address: TOKEN_ADDRESSES.USDC, decimals: 6 },
  { symbol: "DAI", address: TOKEN_ADDRESSES.DAI, decimals: 18 },
];

// ================ 类型定义 ================
type TransactionPhase = 'idle' | 'signing' | 'confirming';

interface TransactionState {
  phase: TransactionPhase;
  error: string | null;
  txHash: `0x${string}` | null;
}

// ================ 主组件 ================
export default function SimpleDeposit() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // 状态管理
  const [amount, setAmount] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState(SUPPORTED_TOKENS[0]);
  const [txState, setTxState] = useState<TransactionState>({
    phase: 'idle',
    error: null,
    txHash: null,
  });

  // 用于追踪当前交易哈希
  const txHashRef = useRef<`0x${string}` | null>(null);

  // 获取代币余额
  const { 
    data: tokenBalance,
    refetch: refetchBalance 
  } = useReadContract({
    address: selectedToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address && isConnected },
  });

  // 获取授权额度
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

  // 写入合约
  const { 
    writeContractAsync 
  } = useWriteContract();

  // 交易确认 - 使用 ref 来追踪当前的 txHash
  const { 
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isTxError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHashRef.current ?? undefined,
  });

  // ================ 计算属性 ================
  const parsedAmount = amount ? parseUnits(amount, selectedToken.decimals) : 0n;
  const isApproved = !!allowance && allowance >= parsedAmount && parsedAmount > 0n;
  const hasInsufficientBalance = !!tokenBalance && tokenBalance < parsedAmount;

  const formattedBalance = tokenBalance 
    ? formatUnits(tokenBalance, selectedToken.decimals) 
    : "0";

  // ================ 副作用 ================
  
  // 处理交易确认状态
  useEffect(() => {
    console.log("交易状态变化:", {
      isConfirming,
      isConfirmed,
      isTxError,
      receiptError,
      currentTxHash: txHashRef.current
    });

    if (isConfirmed) {
      // 交易成功
      console.log("交易确认成功!");
      setTxState(prev => ({
        ...prev,
        phase: 'idle',
      }));
      
      // 延迟刷新数据
      setTimeout(() => {
        refetchBalance();
        refetchAllowance();
        setAmount("");
      }, 2000);
    }
  }, [isConfirmed, refetchBalance, refetchAllowance]);

  // 处理交易失败
  useEffect(() => {
    if (isTxError && receiptError) {
      console.log("交易失败:", receiptError);
      const errorMsg = receiptError instanceof Error 
        ? receiptError.message 
        : "交易执行失败";
      
      setTxState(prev => ({
        ...prev,
        phase: 'idle',
        error: errorMsg.includes("execution reverted") 
          ? "合约执行失败，请检查参数或余额" 
          : errorMsg,
      }));
    }
  }, [isTxError, receiptError]);

  // ================ 工具函数 ================
  const formatError = (error: unknown): string => {
    if (!error) return "未知错误";
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes("user rejected") || message.includes("User rejected")) {
      return "用户取消了交易";
    }
    if (message.includes("execution reverted")) {
      return "合约执行失败，请检查参数";
    }
    if (message.includes("insufficient funds")) {
      return "余额不足（包含Gas费）";
    }
    
    // 截断长错误消息
    return message.length > 80 ? message.substring(0, 80) + "..." : message;
  };

  const handleApprove = async () => {
    if (!address || parsedAmount === 0n) {
      setTxState(prev => ({ ...prev, error: "请输入有效的存款金额" }));
      return;
    }

    setTxState({ phase: 'signing', error: null, txHash: null });

    try {
      const hash = await writeContractAsync({
        address: selectedToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [AAVE_V3_POOL_ADDRESS, parsedAmount],
        gas: 250000n,
        maxFeePerGas: parseGwei("20"),
        maxPriorityFeePerGas: parseGwei("1"),
      });

      txHashRef.current = hash;
      setTxState({ phase: 'confirming', error: null, txHash: hash });
    } catch (err: unknown) {
      console.error("授权失败:", err);
      setTxState({
        phase: 'idle',
        error: formatError(err),
        txHash: null,
      });
    }
  };

  const handleDeposit = async () => {
    if (!address || parsedAmount === 0n) {
      setTxState(prev => ({ ...prev, error: "请输入有效的存款金额" }));
      return;
    }

    if (hasInsufficientBalance) {
      setTxState(prev => ({ ...prev, error: "代币余额不足" }));
      return;
    }

    setTxState({ phase: 'signing', error: null, txHash: null });

    try {
      console.log("开始存款:", {
        token: selectedToken.symbol,
        amount: parsedAmount.toString(),
        decimals: selectedToken.decimals
      });

      const hash = await writeContractAsync({
        address: AAVE_V3_POOL_ADDRESS,
        abi: PoolArtifact.abi,
        functionName: "deposit",
        args: [
          selectedToken.address,
          parsedAmount,
          address,
          0
        ],
        gas: 300000n,
        maxFeePerGas: parseGwei("25"),
        maxPriorityFeePerGas: parseGwei("2"),
      });

      console.log("存款交易已发送:", hash);
      txHashRef.current = hash;
      setTxState({ phase: 'confirming', error: null, txHash: hash });
    } catch (err: unknown) {
      console.error("存款失败:", err);
      setTxState({
        phase: 'idle',
        error: formatError(err),
        txHash: null,
      });
    }
  };

  const handleTokenChange = (symbol: string) => {
    const token = SUPPORTED_TOKENS.find(t => t.symbol === symbol);
    if (token) {
      setSelectedToken(token);
      setAmount("");
      // 重置交易状态
      txHashRef.current = null;
      setTxState({ phase: 'idle', error: null, txHash: null });
    }
  };

  const handleRetry = () => {
    txHashRef.current = null;
    setTxState({ phase: 'idle', error: null, txHash: null });
  };

  const getButtonState = () => {
    if (!isConnected) return { text: "连接钱包", disabled: true, action: null };
    if (!amount || parseFloat(amount) <= 0) return { text: "输入金额", disabled: true, action: null };
    if (hasInsufficientBalance) return { text: "余额不足", disabled: true, action: null };
    
    if (txState.phase === 'signing') return { text: "等待签名...", disabled: true, action: null };
    if (txState.phase === 'confirming') return { text: "确认中...", disabled: true, action: null };
    
    if (!isApproved) return { text: "授权代币", disabled: false, action: handleApprove };
    return { text: "存入 Aave", disabled: false, action: handleDeposit };
  };

  // ================ 渲染逻辑 ================
  if (!isConnected) {
    return (
      <div className="simple-deposit-container">
        <div className="connect-card">
          <span className="icon">🔌</span>
          <h3>连接钱包</h3>
          <p>请先连接钱包以使用存款功能</p>
        </div>
      </div>
    );
  }

  const buttonState = getButtonState();

  return (
    <div className="simple-deposit-container">
      <div className="deposit-card">
        <div className="card-header">
          <span className="icon">💰</span>
          <h3>Aave 存款</h3>
          <span className="network-badge">
            {chainId === 11155111 ? "Sepolia" : "Mainnet"}
          </span>
        </div>

        {/* 代币选择 */}
        <div className="form-group">
          <label>选择代币</label>
          <select
            value={selectedToken.symbol}
            onChange={(e) => handleTokenChange(e.target.value)}
            disabled={txState.phase !== 'idle'}
          >
            {SUPPORTED_TOKENS.map(token => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* 余额显示 */}
        <div className="balance-display">
          <span>钱包余额</span>
          <span>{formattedBalance} {selectedToken.symbol}</span>
        </div>

        {/* 金额输入 */}
        <div className="form-group">
          <label>存款金额</label>
          <div className="input-wrapper">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={txState.phase !== 'idle'}
            />
            <span className="token-label">{selectedToken.symbol}</span>
          </div>
        </div>

        {/* 授权提示 */}
        {!isApproved && parsedAmount > 0n && (
          <div className="info-box">
            ℹ️ 首次使用需要授权 Aave 使用您的 {selectedToken.symbol}
          </div>
        )}

        {/* 操作按钮 */}
        <button
          onClick={buttonState.action ?? (() => {})}
          disabled={buttonState.disabled}
          className={`action-btn ${!isApproved ? 'approve' : 'deposit'}`}
        >
          {buttonState.text}
        </button>

        {/* 状态显示 */}
        {txState.phase === 'confirming' && (
          <div className="status warning">
            ⏳ 交易确认中，请等待...
          </div>
        )}
        
        {isConfirmed && (
          <div className="status success">
            ✅ 存款成功！
          </div>
        )}
        
        {txState.error && (
          <div className="status error">
            ❌ {txState.error}
          </div>
        )}

        {/* 错误重试按钮 */}
        {txState.error && (
          <button onClick={handleRetry} className="retry-btn">
            重试
          </button>
        )}

        {/* 交易链接 */}
        {txState.txHash && (
          <div className="tx-link">
            <a
              href={`https://sepolia.etherscan.io/tx/${txState.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 查看交易详情
            </a>
            <div className="tx-hash">{txState.txHash.slice(0, 10)}...{txState.txHash.slice(-8)}</div>
          </div>
        )}

        {/* 测试网提示 */}
        {chainId === 11155111 && (
          <div className="hint">
            💡 测试网建议金额 ≤ 0.1 ETH
          </div>
        )}
      </div>
    </div>
  );
}

// ================ 样式 ================
const style = document.createElement('style');
style.textContent = `
.simple-deposit-container {
  max-width: 420px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.connect-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.connect-card .icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.connect-card h3 {
  margin: 0 0 8px 0;
  color: #212529;
}

.connect-card p {
  margin: 0;
  color: #6c757d;
}

.deposit-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e9ecef;
}

.card-header .icon {
  font-size: 28px;
}

.card-header h3 {
  margin: 0;
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: #212529;
}

.network-badge {
  background: #e7f5ff;
  color: #1971c2;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #495057;
  font-weight: 500;
}

.form-group select,
.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group select:focus,
.form-group input:focus {
  outline: none;
  border-color: #339af0;
}

.form-group input:disabled,
.form-group select:disabled {
  background: #f8f9fa;
}

.balance-display {
  display: flex;
  justify-content: space-between;
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.balance-display span:first-child {
  color: #6c757d;
}

.balance-display span:last-child {
  font-weight: 600;
  color: #212529;
}

.input-wrapper {
  position: relative;
}

.input-wrapper input {
  padding-right: 60px;
}

.token-label {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: #e9ecef;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
}

.info-box {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #856404;
  text-align: center;
}

.action-btn {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 48px;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.approve {
  background: linear-gradient(135deg, #ffd43b 0%, #fab005 100%);
  color: #212529;
}

.action-btn.deposit {
  background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
  color: white;
}

.status {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
}

.status.success {
  background: #d3f9d8;
  color: #2b8a3e;
  border: 1px solid #b2f2bb;
}

.status.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status.error {
  background: #ffe3e3;
  color: #c92a2a;
  border: 1px solid #ffa8a8;
}

.retry-btn {
  width: 100%;
  margin-top: 12px;
  padding: 10px 24px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: #f8f9fa;
}

.tx-link {
  margin-top: 16px;
  text-align: center;
}

.tx-link a {
  color: #1971c2;
  text-decoration: none;
  font-size: 14px;
  display: block;
}

.tx-link a:hover {
  text-decoration: underline;
}

.tx-hash {
  margin-top: 8px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #6c757d;
}

.hint {
  margin-top: 16px;
  text-align: center;
  font-size: 12px;
  color: #6c757d;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}
`;
document.head.appendChild(style);