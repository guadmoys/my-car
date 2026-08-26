<script setup lang="ts">
import { IonToast } from '@ionic/vue'
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <ion-toast
    v-for="toast in toasts"
    :key="toast.id"
    :is-open="true"
    :message="toast.message"
    :duration="4000"
    position="bottom"
    :buttons="toast.action ? [{ text: toast.action.label, handler: toast.action.onAction }] : []"
    @did-dismiss="dismiss(toast.id)"
  />
</template>
