import { createApp, inject } from "vue"
import { UseWagmiPlugin, createConfig } from "use-wagmi"
import { injected } from "use-wagmi/connectors"
import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"
import App from "/src/App.vue" 

// 创建wagmi配置
const config = createConfig({
  autoConnect: true, // 自动连接上次连接的钱包
  publicClient: createPublicClient({
    chain: mainnet,
    transport: http(),
  }),
  connectors: [
    injected({
      chains: [mainnet],
    }),
  ],
})

// 创建Vue应用
const app = createApp(App)

// 使用wagmi插件
app.use(UseWagmiPlugin, config)

app.mount("#app")