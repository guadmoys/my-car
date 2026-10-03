<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IonItem, IonLabel, IonList, IonListHeader, IonToggle, type ToggleCustomEvent } from '@ionic/vue'
import { notificationsOutline } from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'
import {
  getNotificationPermission,
  isNotificationApiSupported,
  isNotificationsEnabled,
  requestNotificationPermission,
  sendTestNotification,
  setNotificationsEnabled,
} from '../../utils/alerts/notifications'
import {
  backgroundStatus,
  runAlertsNow,
  unregisterBackgroundCheck,
  type BackgroundStatus,
} from '../../composables/useAlerts'
import { computeAlerts } from '../../utils/alerts/alerts'
import { loadAllBundles } from '../../utils/alerts/alertDispatcher'
import { downloadIcsCalendar } from '../../utils/alerts/ics'
import { useToast } from '../../composables/useToast'
import { haptic } from '../../utils/haptics'

const emit = defineEmits<{
  notificationsEnabled: []
}>()

const toast = useToast()

const notificationsSupported = isNotificationApiSupported()
const notificationsOn = ref(isNotificationsEnabled() && getNotificationPermission() === 'granted')
const notificationsBlocked = ref(getNotificationPermission() === 'denied')

async function handleToggleNotifications(checked: boolean) {
  if (!checked) {
    setNotificationsEnabled(false)
    notificationsOn.value = false
    void unregisterBackgroundCheck()
    return
  }
  const permission = await requestNotificationPermission()
  if (permission === 'granted') {
    setNotificationsEnabled(true)
    notificationsOn.value = true
    notificationsBlocked.value = false
    emit('notificationsEnabled')
    // Give the background check a moment to register before reading its state back.
    setTimeout(refreshBackground, 800)
  } else {
    setNotificationsEnabled(false)
    notificationsOn.value = false
    notificationsBlocked.value = permission === 'denied'
  }
}

const background = ref<BackgroundStatus>('off')

async function refreshBackground() {
  background.value = await backgroundStatus()
}

onMounted(() => {
  void refreshBackground()
})

const BACKGROUND_HINT: Record<BackgroundStatus, string> = {
  active:
    'Фоновая проверка включена: уведомления могут приходить и при закрытом приложении. Браузер сам выбирает время, обычно раз в несколько часов.',
  off: 'Уведомления приходят, когда приложение открыто. Фоновая проверка выключена.',
  unsupported:
    'На этом устройстве (например, iPhone) браузер не умеет проверять сроки в фоне: уведомления приходят, когда приложение открыто. Чтобы напоминания звонили всегда, добавьте сроки в календарь.',
  blocked:
    'Браузер не разрешил фоновую проверку. Установите приложение на главный экран — тогда она обычно включается.',
}

async function handleTestNotification() {
  haptic('tap')
  const result = await sendTestNotification()
  toast.show(
    result === 'sent'
      ? 'Отправлено — проверьте, что оно пришло'
      : result === 'no-permission'
        ? 'Сначала включите уведомления и разрешите их в браузере'
        : 'Уведомления недоступны на этом устройстве',
  )
}

async function handleExportDeadlines() {
  haptic('tap')
  const alerts = computeAlerts(await loadAllBundles(), Date.now()).filter((a) => a.at > Date.now())
  if (alerts.length === 0) {
    toast.show('Ближайших сроков пока нет')
    return
  }
  downloadIcsCalendar(
    alerts.slice(0, 300).map((a) => ({
      uid: a.key.replace(/[^A-Za-z0-9-]/g, '_'),
      title: `${a.approximate ? '≈ ' : ''}${a.title}`,
      description: a.body,
      start: a.at,
    })),
  )
  toast.show(`В календарь: ${Math.min(alerts.length, 300)}`)
}

async function handleCheckNow() {
  haptic('tap')
  await runAlertsNow()
  toast.show('Проверка выполнена')
}
</script>

<template>
  <ion-list v-if="notificationsSupported" inset>
    <ion-list-header>
      <ion-label>Уведомления</ion-label>
      <HintButton text="О ТО («скоро» и «просрочено»), документах, напоминаниях и гарантиях — по всем вашим машинам" />
    </ion-list-header>
    <ion-item lines="none">
      <SettingsIconBadge slot="start" :icon="notificationsOutline" color="danger" />
      <ion-toggle
        justify="space-between"
        :checked="notificationsOn"
        @ion-change="(e: ToggleCustomEvent) => handleToggleNotifications(e.detail.checked)"
      >
        Уведомлять о сроках
      </ion-toggle>
    </ion-item>
    <template v-if="notificationsOn">
      <ion-item button :detail="false" lines="full" @click="handleTestNotification">
        <ion-label color="primary">Проверить уведомление</ion-label>
      </ion-item>
      <ion-item button :detail="false" lines="full" @click="handleCheckNow">
        <ion-label color="primary">Проверить сроки сейчас</ion-label>
      </ion-item>
    </template>
    <ion-item button :detail="false" lines="none" @click="handleExportDeadlines">
      <ion-label color="primary" class="ion-text-wrap">Добавить сроки в календарь (.ics)</ion-label>
    </ion-item>
  </ion-list>
  <p v-if="notificationsOn" class="hint">{{ BACKGROUND_HINT[background] }}</p>
  <p class="hint">
    Календарь надёжнее всего: событие со звонком создаётся один раз и срабатывает даже при закрытом приложении. После
    новых записей добавьте сроки в календарь снова.
  </p>
  <p v-if="notificationsBlocked" class="hint error">
    Уведомления заблокированы в браузере — включите их в настройках сайта, чтобы приложение
    могло их показывать
  </p>
</template>

<style scoped>
.hint {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 4px 32px 16px;
  line-height: 1.4;
}

.hint.error {
  color: var(--ion-color-danger);
}
</style>
