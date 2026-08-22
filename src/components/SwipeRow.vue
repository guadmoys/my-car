<script setup lang="ts">
import { ref } from 'vue'
import { haptic } from '../utils/haptics'

interface SwipeAction {
  label: string
  colorVar: string
  onTrigger: () => void
}

const props = defineProps<{
  /** Revealed on the right edge when the content is dragged left. */
  rightAction?: SwipeAction
  /** Revealed on the left edge when the content is dragged right. */
  leftAction?: SwipeAction
}>()

const ACTION_WIDTH = 84

const dragX = ref(0)
const dragging = ref(false)
let suppressClick = false
let startX = 0
let startY = 0
let pointerId: number | null = null
let axisLocked: 'x' | 'y' | null = null
let armed = false

function clamp(v: number): number {
  const min = props.rightAction ? -ACTION_WIDTH : 0
  const max = props.leftAction ? ACTION_WIDTH : 0
  return Math.min(max, Math.max(min, v))
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  pointerId = e.pointerId
  startX = e.clientX
  startY = e.clientY
  axisLocked = null
  dragging.value = true
}

function onPointerMove(e: PointerEvent) {
  if (pointerId === null || e.pointerId !== pointerId) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (axisLocked === null) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (axisLocked === 'x') {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }
  if (axisLocked !== 'x') return
  e.preventDefault()
  dragX.value = clamp(dx)
  if (Math.abs(dx) > 10) suppressClick = true

  const threshold = ACTION_WIDTH * 0.65
  const nowArmed = dragX.value <= -threshold || dragX.value >= threshold
  if (nowArmed !== armed) {
    armed = nowArmed
    if (armed) haptic('tap')
  }
}

function endDrag() {
  if (pointerId === null) return
  pointerId = null
  dragging.value = false
  const threshold = ACTION_WIDTH * 0.65
  if (dragX.value <= -threshold && props.rightAction) {
    props.rightAction.onTrigger()
  } else if (dragX.value >= threshold && props.leftAction) {
    props.leftAction.onTrigger()
  }
  dragX.value = 0
  axisLocked = null
  armed = false
}

function onClickCapture(e: MouseEvent) {
  if (suppressClick) {
    e.stopPropagation()
    e.preventDefault()
    suppressClick = false
  }
}
</script>

<template>
  <div class="swipe-row">
    <div
      v-if="leftAction"
      class="reveal reveal-left"
      :style="{ background: leftAction.colorVar, opacity: Math.max(0, Math.min(1, dragX / ACTION_WIDTH)) }"
    >
      {{ leftAction.label }}
    </div>
    <div
      v-if="rightAction"
      class="reveal reveal-right"
      :style="{ background: rightAction.colorVar, opacity: Math.max(0, Math.min(1, -dragX / ACTION_WIDTH)) }"
    >
      {{ rightAction.label }}
    </div>
    <div
      class="content"
      :class="{ dragging }"
      :style="{ transform: `translateX(${dragX}px)` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @click.capture="onClickCapture"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.swipe-row {
  position: relative;
  overflow: hidden;
}

.content {
  position: relative;
  touch-action: pan-y;
}

.content:not(.dragging) {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.reveal {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  pointer-events: none;
}

.reveal-left {
  left: 0;
}

.reveal-right {
  right: 0;
}
</style>
