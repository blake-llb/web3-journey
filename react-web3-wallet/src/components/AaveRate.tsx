import { useReadContract, useChainId, useSwitchChain } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
// // Ethereum 主网 Aave V3 Pool 地址
const AAVE_POOL_ADDRESS_MAINNET = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
// Sepolia 测试网 Aave V3 Pool 地址
const AAVE_POOL_ADDRESS_SEPOLIA = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951";
// 根据网络选择合约地址
const AAVE_POOL_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "asset",
        type: "address",
      },
    ],
    name: "getReserveData",
    outputs: [
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "data",
                type: "uint256",
              },
            ],
            internalType: "struct DataTypes.ReserveConfigurationMap",
            name: "configuration",
            type: "tuple",
          },
          {
            internalType: "uint128",
            name: "liquidityIndex",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "currentLiquidityRate",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "variableBorrowIndex",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "currentVariableBorrowRate",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "currentStableBorrowRate",
            type: "uint128",
          },
          {
            internalType: "uint40",
            name: "lastUpdateTimestamp",
            type: "uint40",
          },
          {
            internalType: "uint16",
            name: "id",
            type: "uint16",
          },
          {
            internalType: "address",
            name: "aTokenAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "stableDebtTokenAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "variableDebtTokenAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "interestRateStrategyAddress",
            type: "address",
          },
          {
            internalType: "uint128",
            name: "accruedToTreasury",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "unbacked",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "isolationModeTotalDebt",
            type: "uint128",
          },
        ],
        internalType: "struct DataTypes.ReserveData",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
// 主网 WETH 地址
const WETH_ADDRESS_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
// Sepolia WETH 地址
const WETH_ADDRESS_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
// const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const AaveRate: React.FC = () => {
  // 获取当前连接的链 ID
  const chainId = useChainId();
  // 获取切换链的方法
  const { switchChain } = useSwitchChain();

  interface config {
    poolAddress: string;
    assetAddress: string;
    networkName: string;
  }
  // 根据当前网络动态选择合约地址和资产地址
  const getContractConfig = () => {
    if (chainId === mainnet.id) {
      return {
        poolAddress: AAVE_POOL_ADDRESS_MAINNET,
        assetAddress: WETH_ADDRESS_MAINNET,
        networkName: 'Ethereum 主网',
      };
    } else if (chainId === sepolia.id) {
      return {
        poolAddress: AAVE_POOL_ADDRESS_SEPOLIA,
        assetAddress: WETH_ADDRESS_SEPOLIA,
        networkName: 'Sepolia 测试网',
      };
    }
    // 默认返回主网配置（但调用会失败）
    return {
      poolAddress: AAVE_POOL_ADDRESS_MAINNET,
      assetAddress: WETH_ADDRESS_MAINNET,
      networkName: '未知网络',
    };
  };
  const config: config = getContractConfig();

  const { data, isLoading, isError, error } = useReadContract({
    address: config.poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "getReserveData",
    args: [config.assetAddress],
    chainId,
  });

  // 调试信息
  console.log('当前链 ID:', chainId);
  console.log('合约地址:', config.poolAddress);
  console.log('资产地址:', config.assetAddress);
  console.log('合约调用数据:', data);
  
  // 安全转换 BigInt 到 Number，避免精度丢失
  const safeBigIntToNumber = (value: bigint | number | undefined): number => {
    if (value === undefined || value === null) return 0;
    try {
      return typeof value === 'bigint' ? Number(value) : Number(value);
    } catch {
      return 0;
    }
  };

  // 计算利率
  const getRateDisplay = () => {
    if (isLoading) return '加载中...';
    if (isError) return `错误：${error?.message}`;
    if (!data) return '无数据';

    const reserveData = Array.isArray(data) ? data[0] : data;
    const liquidityRate = reserveData?.currentLiquidityRate;
    const rate = (safeBigIntToNumber(liquidityRate) / 1e27) * 100;
    return `${rate.toFixed(2)}%`;
  };
  
  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      maxWidth: '400px',
      margin: '20px auto'
    }}>
      <h3 style={{ margin: '0 0 15px 0' }}>Aave ETH 存款利率</h3>
      
      {/* 当前网络信息 */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '10px', 
        background: '#f5f5f5',
        borderRadius: '4px'
      }}>
        <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666' }}>
          当前网络：{config.networkName} (ID: {chainId})
        </p>
      </div>

      {/* 利率显示 */}
      <div style={{ 
        fontSize: '24px', 
        fontWeight: 'bold',
        color: isError ? '#f00' : '#3b82f6',
        marginBottom: '15px'
      }}>
        {getRateDisplay()}
      </div>

      {/* 网络切换按钮 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {chainId !== mainnet.id && (
          <button 
            onClick={() => switchChain({ chainId: mainnet.id })}
            style={{ 
              padding: '8px 16px', 
              background: chainId === mainnet.id ? '#ccc' : '#3b82f6', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: chainId === mainnet.id ? 'not-allowed' : 'pointer',
              opacity: chainId === mainnet.id ? 0.6 : 1
            }}
            disabled={chainId === mainnet.id}
          >
            切换到主网
          </button>
        )}
        {chainId !== sepolia.id && (
          <button 
            onClick={() => switchChain({ chainId: sepolia.id })}
            style={{ 
              padding: '8px 16px', 
              background: chainId === sepolia.id ? '#ccc' : '#10b981', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: chainId === sepolia.id ? 'not-allowed' : 'pointer',
              opacity: chainId === sepolia.id ? 0.6 : 1
            }}
            disabled={chainId === sepolia.id}
          >
            切换到测试网
          </button>
        )}
      </div>
    </div>
  )
};

export default AaveRate;
