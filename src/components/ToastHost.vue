<script setup lang="ts">
import { useToast, type ToastAction } from '../composables/useToast'

const { toasts, dismiss } = useToast()

function handleAction(id: number, action: ToastAction) {
  action.onAction()
  dismiss(id)
}
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" class="toast">
        <span class="toast-message">{{ toast.message }}</span>
        <button
          v-if="toast.action"
          class="toast-action"
          @click="handleAction(toast.id, toast.action)"
        >
          {{ toast.action.label }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(78px + var(--safe-bottom));
  z-index: 80;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, #1c1c1e 92%, transparent);
  color: #fff;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  pointer-events: auto;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.toast-message {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  min-width: 0;
}

.toast-action {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--blue);
}

.toast-action:active {
  opacity: 0.6;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
</style>
