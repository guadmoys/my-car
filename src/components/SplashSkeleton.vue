<template>
  <div class="skeleton-page">
    <div class="sk sk-title" />
    <div class="sk sk-hero" />
    <div class="quick-row">
      <div class="sk sk-quick" />
      <div class="sk sk-quick" />
    </div>
    <div class="sk sk-label" />
    <div class="sk sk-card" />
  </div>
</template>

<style scoped>
.skeleton-page {
  min-height: 100dvh;
  max-width: 560px;
  margin: 0 auto;
  padding: calc(24px + var(--safe-top)) 16px;
}

.sk {
  border-radius: var(--radius-lg);
  background: linear-gradient(
    100deg,
    var(--fill-secondary) 40%,
    color-mix(in srgb, var(--fill-secondary) 40%, transparent) 55%,
    var(--fill-secondary) 70%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.sk-title {
  width: 140px;
  height: 30px;
  border-radius: 8px;
  margin: 8px 0 20px;
}

.sk-hero {
  height: 150px;
  margin-bottom: 28px;
}

.quick-row {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}

.sk-quick {
  flex: 1;
  height: 76px;
}

.sk-label {
  width: 120px;
  height: 14px;
  border-radius: 6px;
  margin-bottom: 10px;
}

.sk-card {
  height: 130px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
