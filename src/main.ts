import { createApp } from 'vue'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import { defineCustomElement as defineIonTabBar } from '@ionic/core/components/ion-tab-bar.js'
import { defineCustomElement as defineIonTabButton } from '@ionic/core/components/ion-tab-button.js'

// TabBar.vue renders these as raw custom elements (see vite.config.ts), so
// they need to be registered directly — the @ionic/vue wrappers that
// normally do this expect an ancestor <IonTabs>, which this app doesn't use.
defineIonTabBar()
defineIonTabButton()

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css'

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* Ionic theme variables — palette mapping for this app */
import './theme/variables.css'
/* Automatic dark mode, following the OS/browser color-scheme preference */
import '@ionic/vue/css/palettes/dark.system.css'
import './style.css'

import { initAppUpdate } from './utils/appUpdate'

const app = createApp(App).use(IonicVue)

app.mount('#app')
initAppUpdate()
