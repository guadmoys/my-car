import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { initAppUpdate } from './utils/appUpdate'

createApp(App).mount('#app')
initAppUpdate()
