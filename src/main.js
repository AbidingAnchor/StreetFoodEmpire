import Phaser from 'phaser'
import './index.css'
import { BootScene } from './game/BootScene.js'
import { HotDogScene } from './game/HotDogScene.js'
import { TacoScene } from './game/TacoScene.js'
import {
  applyOfflineEarnings,
  estimateGlobalCoinsPerSecond,
  loadSave,
  saveState,
} from './game/save.js'
import { formatCoins, formatRate } from './game/economy.js'

const state = loadSave()
const offline = applyOfflineEarnings(state)
saveState(state)

const coinEl = document.getElementById('hud-coins')
const rateEl = document.getElementById('hud-rate')
const tabHot = document.getElementById('tab-hotdog')
const tabTaco = document.getElementById('tab-taco')

function updateHud() {
  const cps = estimateGlobalCoinsPerSecond(state)
  coinEl.textContent = `🪙 ${formatCoins(state.coins)}`
  rateEl.textContent = `+${formatRate(cps)}/s`
}

function syncTabStyles() {
  const hotOn = state.activeLocation === 'hotdog'
  tabHot.classList.toggle(
    'bg-gradient-to-r',
    hotOn,
  )
  tabHot.classList.toggle('from-yellow-400', hotOn)
  tabHot.classList.toggle('to-amber-400', hotOn)
  tabHot.classList.toggle('text-red-950', hotOn)
  tabHot.classList.toggle('ring-2', hotOn)
  tabHot.classList.toggle('bg-black/25', !hotOn)
  tabHot.classList.toggle('text-amber-100', !hotOn)

  const tacoOn = state.activeLocation === 'taco'
  tabTaco.classList.toggle('bg-gradient-to-r', tacoOn)
  tabTaco.classList.toggle('from-yellow-400', tacoOn)
  tabTaco.classList.toggle('to-amber-400', tacoOn)
  tabTaco.classList.toggle('text-red-950', tacoOn)
  tabTaco.classList.toggle('ring-2', tacoOn)
  tabTaco.classList.toggle('bg-black/25', !tacoOn && state.tacoUnlocked)
  tabTaco.classList.toggle('text-amber-100', !tacoOn || !state.tacoUnlocked)
}

function updateTacoTab() {
  if (state.tacoUnlocked) {
    tabTaco.disabled = false
    tabTaco.classList.remove('opacity-35', 'pointer-events-none')
  }
  syncTabStyles()
}

function goToLocation(loc) {
  if (!gameRef) return
  if (loc === 'taco' && !state.tacoUnlocked) return
  state.activeLocation = loc
  saveState(state)
  const key = loc === 'taco' ? 'Taco' : 'HotDog'
  gameRef.scene.stop('HotDog')
  gameRef.scene.stop('Taco')
  gameRef.scene.start(key)
  syncTabStyles()
  updateHud()
}

let gameRef = null

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#ffe8cc',
  fps: {
    target: 60,
    limit: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 640,
  },
  scene: [BootScene, HotDogScene, TacoScene],
  callbacks: {
    postBoot: (game) => {
      gameRef = game
      game.registry.set('state', state)
      game.registry.set('pendingOfflineCoins', offline.offlineCoins)
      const initial =
        state.activeLocation === 'taco' && state.tacoUnlocked ? 'Taco' : 'HotDog'
      game.registry.set('initialSceneKey', initial)
      game.registry.set('onHudUpdate', updateHud)
      game.registry.set('onTacoUnlocked', updateTacoTab)
    },
  },
}

new Phaser.Game(config)

tabHot.addEventListener('click', () => goToLocation('hotdog'))
tabTaco.addEventListener('click', () => goToLocation('taco'))

updateHud()
updateTacoTab()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
