import { useState, useEffect } from "react";
import { 
  useAccount, 
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useReadContract
} from "wagmi";
import { 
  formatEther, 
  parseEther,
  erc20Abi
} from "viem";

// Aave Pool ABI
const AAVE_POOL_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "address", "name": "onBehalfOf", "type": "address" },
      { "internalType": "uint16", "name": "referralCode", "type": "uint16" }
    ],
    "name": "supply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// WETH ABI (用于 wrap)
const WETH_ABI = [
  {
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

// Aave V3 Pool 地址 (Sepolia)
const AAVE_POOL_ADDRESS = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951" as const;

// WETH 地址
const WETH_ADDRESS = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c" as const;

type Step = 'idle' | 'wrap' | 'approve' | 'supply';

export default function NewDeposit() {
  const { address, isConnected } = useAccount();
  
  // 状态
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 写入合约
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // 获取 ETH 余额
  const { data: ethBalance } = useBalance({ address });

  // 获取 WETH 余额
  const { data: wethBalance } = useReadContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address }
  });

  // 获取对 Aave Pool 的授权额度
  const { data: allowance } = useReadContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address!, AAVE_POOL_ADDRESS],
    query: { enabled: !!address }
  });

  // 等待交易确认
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    isError: isTxFailed,
    error: txError 
  } = useWaitForTransactionReceipt({ 
    hash: txHash ?? undefined 
  });

  // 处理交易结果
  useEffect(() => {
    if (isConfirmed) {
      console.log("交易确认成功!");
      setStep('idle');
      setAmount("");
      setTxHash(null);
    }
    
    if (isTxFailed && txError) {
      console.error("交易失败:", txError);
      setStep('idle');
      setError(txError.message || "交易失败");
    }
  }, [isConfirmed, isTxFailed, txError]);

  // 第一步：Wrap ETH 为 WETH
  const handleWrap = async () => {
    if (!address || !amount) return;

    const parsedAmount = parseEther(amount);
    if (parsedAmount === 0n) return;

    // 检查 ETH 余额
    if (ethBalance && ethBalance.value < parsedAmount) {
      setError("ETH 余额不足");
      return;
    }

    setError(null);
    setStep('wrap');

    try {
      console.log("Wrap ETH:", parsedAmount.toString());

      const hash = await writeContractAsync({
        address: WETH_ADDRESS,
        abi: WETH_ABI,
        functionName: 'deposit',
        args: [],
        value: parsedAmount,
      });

      setTxHash(hash);
      console.log("Wrap 交易已发送:", hash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Wrap 失败";
      console.error("Wrap 失败:", err);
      setError(message);
      setStep('idle');
    }
  };

  // 第二步：授权 Aave Pool 使用 WETH（授权最大值）
  const handleApprove = async () => {
    if (!address || !amount) return;

    setError(null);
    setStep('approve');

    try {
      // 授权最大值：2^256 - 1
      const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      console.log("授权 Aave Pool（最大值）...");

      const hash = await writeContractAsync({
        address: WETH_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [AAVE_POOL_ADDRESS, maxApproval],
      });

      setTxHash(hash);
      console.log("授权交易已发送:", hash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "授权失败";
      console.error("授权失败:", err);
      setError(message);
      setStep('idle');
    }
  };

  // 第三步：存入 Aave
  const handleDeposit = async () => {
    if (!address || !amount) return;

    const parsedAmount = parseEther(amount);
    if (parsedAmount === 0n) return;

    setError(null);
    setStep('deposit');

    try {
      console.log("存入 Aave:", parsedAmount.toString());

      const hash = await writeContractAsync({
        address: AAVE_POOL_ADDRESS,
        abi: AAVE_POOL_ABI,
        functionName: 'supply',
        args: [WETH_ADDRESS, parsedAmount, address, 0],
        // 不设置 gas，让钱包自动估算
      });

      setTxHash(hash);
      console.log("存款交易已发送:", hash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "存款失败";
      console.error("存款失败:", err);
      setError(message);
      setStep('idle');
    }
  };

  // 获取按钮状态
  const getButtonState = () => {
    const parsedAmount = amount ? parseEther(amount) : 0n;
    const hasEthBalance = ethBalance ? ethBalance.value >= parsedAmount : false;
    const hasWethBalance = wethBalance ? wethBalance >= parsedAmount : false;
    const hasAllowance = allowance ? allowance >= parsedAmount : false;
    const hasValidAmount = parsedAmount > 0n;

    if (!isConnected) return { text: "连接钱包", disabled: true, action: null };
    if (!hasValidAmount) return { text: "输入金额", disabled: true, action: null };
    if (!hasEthBalance) return { text: "ETH 余额不足", disabled: true, action: null };
    
    // 如果当前有待处理的交易
    if (step !== 'idle') return { text: "处理中...", disabled: true, action: null };
    
    // 检查是否需要 wrap
    if (!hasWethBalance && wethBalance !== undefined) {
      return { text: "转WETH", disabled: false, action: handleWrap, hint: "先将 ETH 转为 WETH" };
    }
    
    // 检查是否需要授权
    if (!hasAllowance && hasWethBalance) {
      return { text: "授权 Aave", disabled: false, action: handleApprove, hint: "授权 Aave 使用您的 WETH" };
    }
    
    // 可以存款
    return { text: "存入 Aave", disabled: false, action: handleDeposit, hint: "将 WETH 存入 Aave 赚取利息" };
  };

  // 获取按钮文本（显示步骤）
  const getButtonText = () => {
    const btn = getButtonState();
    if (isWritePending) return "等待签名...";
    if (isConfirming) return "确认中...";
    return btn.text;
  };

  // 计算
  const formattedBalance = ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : "0";
  const formattedWethBalance = wethBalance ? formatEther(wethBalance) : "0";

  // ================ 渲染 ================

  if (!isConnected) {
    return (
      <div className="new-deposit-container">
        <div className="card">
          <span className="icon">🔌</span>
          <h3>连接钱包</h3>
          <p>请先连接钱包以使用存款功能</p>
        </div>
      </div>
    );
  }

  const buttonState = getButtonState();

  return (
    <div className="new-deposit-container">
      <div className="card">
        <div className="header">
          <span className="icon">💰</span>
          <h3>ETH 存款</h3>
          <span className="badge">Sepolia</span>
        </div>

        {/* 余额显示 */}
        <div className="info-row">
          <span>ETH 余额</span>
          <span className="value">{formattedBalance} ETH</span>
        </div>
        <div className="info-row">
          <span>WETH 余额</span>
          <span className="value">{formattedWethBalance} WETH</span>
        </div>

        {/* 金额输入 */}
        <div className="field">
          <label>存款金额</label>
          <div className="input-wrap">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={step !== 'idle'}
            />
            <span className="suffix">ETH</span>
          </div>
        </div>

        {/* 步骤提示 */}
        {buttonState.hint && (
          <div className="info-box">
            ℹ️ {buttonState.hint}
          </div>
        )}

        {/* 按钮 */}
        <button 
          onClick={buttonState.action ?? (() => {})}
          disabled={buttonState.disabled}
          className="btn deposit"
        >
          {getButtonText()}
        </button>

        {/* 状态显示 */}
        {isWritePending && (
          <div className="status warning">⏳ 等待钱包签名...</div>
        )}
        
        {isConfirming && (
          <div className="status warning">⏳ 交易确认中，请等待...</div>
        )}
        
        {isConfirmed && (
          <div className="status success">✅ 操作成功！</div>
        )}
        
        {error && (
          <div className="status error">❌ {error}</div>
        )}

        {/* 交易链接 */}
        {txHash && (
          <div className="tx-info">
            <a 
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 查看交易详情
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ================ 样式 ================
const css = `
.new-deposit-container {
  max-width: 420px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e9ecef;
}

.header .icon {
  font-size: 28px;
}

.header h3 {
  margin: 0;
  flex: 1;
  font-size: 18px;
  font-weight: 600;
}

.badge {
  background: #e7f5ff;
  color: #1971c2;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #495057;
  font-weight: 500;
}

.field input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
}

.field input:focus {
  outline: none;
  border-color: #339af0;
}

.field input:disabled {
  background: #f8f9fa;
}

.input-wrap {
  position: relative;
}

.input-wrap input {
  padding-right: 60px;
}

.suffix {
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

.info-row {
  background: #f8f9fa;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #495057;
  display: flex;
  justify-content: space-between;
}

.info-row .value {
  font-weight: 600;
  color: #212529;
}

.info-box {
  background: #e7f5ff;
  border: 1px solid #a5d8ff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #1971c2;
  text-align: center;
}

.btn {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.deposit {
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

.tx-info {
  margin-top: 16px;
  text-align: center;
}

.tx-info a {
  color: #1971c2;
  text-decoration: none;
  font-size: 14px;
}

.tx-info a:hover {
  text-decoration: underline;
}
`;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);