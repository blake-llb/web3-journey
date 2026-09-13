/**
 * WETH9 合约 ABI（最小可用集）
 * WETH 是把 ETH 包装成 ERC20 的合约，Aave 等 DeFi 协议只能接受 ERC20
 *
 * 包含：
 * - deposit(): payable，把 msg.value 数量的 ETH 换成 WETH
 * - withdraw(uint256): 把 WETH 换回 ETH
 *
 * 完整 ABI 参考：https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
 */
export const WETH_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'wad', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const
