<script setup lang="ts">
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <h1 class="logo">
          <span class="logo-icon">♪</span>
          Music Hunter
        </h1>
        <nav class="nav">
          <router-link to="/" class="nav-link">首页</router-link>
        </nav>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --bg: #0f0f23;
  --bg-card: #1a1a2e;
  --bg-input: #16213e;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --border: #334155;
  --success: #10b981;
  --warning: #f59e0b;
  --radius: 12px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 1.8rem;
}

.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--primary);
}

.main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  width: 100%;
}
</style>
