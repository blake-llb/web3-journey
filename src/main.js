import { createApp } from 'vue';
import { createConfig, http } from 'use-wagmi'
import { createPublicClient } from 'viem'
import { mainnet } from 'viem/chains'
// import * as useWagmi from 'use-wagmi'
import App from './App.vue'
console.log("-------------------")
// console.log(Object.keys(useWagmi))

// 创建简单配置（只支持MetaMask）
// const config = createConfig({
//   autoConnect: true,
//   publicClient: createPublicClient({
//     chain: mainnet,
//     transport: http(),
//   }),
// })
const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
  ssr: false, // 如果不是SSR应用，设为false
})

const app = createApp(App)
app.use(config)
app.mount('#app')