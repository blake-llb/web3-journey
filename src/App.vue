<template>
  <div class="app">
    <header>
      <h1>简单钱包连接</h1>
      <p>连接MetaMask，查看地址余额</p>
    </header>
    <main>
      <SimpleWallet />
    </main>
  </div>
</template>
<script setup lang="ts">
import SimpleWallet from './components/SimpleWallet.vue'
</script>
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  text-align: center;
  padding: 40px 0;
  color: white;
}

header h1 {
  font-size: 32px;
  margin-bottom: 10px;
}

header p {
  opacity: 0.9;
  font-size: 16px;
}

main {
  flex: 1;
  background: white;
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

footer {
  text-align: center;
  padding: 20px 0;
  color: white;
  opacity: 0.8;
  font-size: 14px;
}
</style>