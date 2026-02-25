<template>
  <div>
    <header>
      <h1>Web3钱包连接示列</h1>
      <p>这是一个手动配置的Vue3 Web3应用</p>
    </header>
    <main>
      <WalletConnect />
    </main>
  </div>
</template>
<script setup>
import WalletConnect  from './components/WalletConnect.vue';
</script>
<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  line-height: 1.6;
}

header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eaeaea;
}

h1 {
  color: #333;
  margin-bottom: 10px;
}

main {
  background: #f9f9f9;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
</style>