<script setup lang="ts">
defineProps<{
  checked: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:checked': [boolean]
}>()
</script>

<template>
  <label class="switch">
    <input
      type="checkbox"
      :checked="checked"
      :disabled="disabled"
      @change="emit('update:checked', ($event.target as HTMLInputElement).checked)"
    />
    <span class="slider" />
  </label>
</template>

<style scoped>
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  background: var(--fill-secondary);
  border-radius: var(--radius-pill);
  transition: background var(--motion-fast);
}

.slider::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform var(--motion-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.switch input:checked + .slider {
  background: var(--green);
}

.switch input:checked + .slider::before {
  transform: translateX(18px);
}

.switch input:disabled + .slider {
  opacity: 0.4;
}
</style>
