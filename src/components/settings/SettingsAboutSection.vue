<script setup lang="ts">
import { ref } from 'vue'
import { IonItem, IonLabel, IonList, IonListHeader } from '@ionic/vue'
import { refreshOutline } from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'
import { checkForUpdate } from '../../utils/appUpdate'
import { useToast } from '../../composables/useToast'
import { haptic } from '../../utils/haptics'

const toast = useToast()
const checkingUpdate = ref(false)
const appVersion = __APP_VERSION__

async function handleCheckForUpdate() {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  haptic('tap')
  try {
    const result = await checkForUpdate()
    if (result === 'updated') {
      toast.show('Найдено обновление — приложение сейчас перезапустится')
    } else if (result === 'up-to-date') {
      toast.show('У вас последняя версия')
    } else if (result === 'offline') {
      toast.show('Нет соединения — попробуйте позже')
    } else {
      toast.show('Не удалось проверить обновления')
    }
  } finally {
    checkingUpdate.value = false
  }
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>
      <ion-label>Обновления</ion-label>
      <HintButton
        text="Приложение само проверяет обновления в фоне. Нажмите, чтобы проверить прямо сейчас — если вышла новая версия, скрипты скачаются заново и приложение перезапустится"
      />
    </ion-list-header>
    <ion-item button :detail="false" lines="none" :disabled="checkingUpdate" @click="handleCheckForUpdate">
      <SettingsIconBadge slot="start" :icon="refreshOutline" color="primary" />
      <ion-label color="primary">{{ checkingUpdate ? 'Проверяем…' : 'Проверить обновления' }}</ion-label>
    </ion-item>
  </ion-list>
  <p class="hint">Версия {{ appVersion }}</p>
</template>

<style scoped>
.hint {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 4px 32px 16px;
  line-height: 1.4;
}
</style>
