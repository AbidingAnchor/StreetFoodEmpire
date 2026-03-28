import { UNLOCK_TACO_TOTAL } from './economy.js'

export const SAVE_KEY = 'sfe-phaser-save'

const OFFLINE_CAP_MS = 2 * 60 * 60 * 1000

function defaultLocation() {
  return {
    staff: false,
    counterUpgrades: 0,
    patienceUpgrades: 0,
  }
}

export function defaultState() {
  return {
    version: 1,
    coins: 0,
    totalEarned: 0,
    lastTimestamp: Date.now(),
    tacoUnlocked: false,
    tacoUnlockPopupShown: false,
    activeLocation: 'hotdog',
    locations: {
      hotdog: defaultLocation(),
      taco: defaultLocation(),
    },
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return defaultState()
    const data = JSON.parse(raw)
    const base = defaultState()
    const merged = {
      ...base,
      ...data,
      locations: {
        hotdog: { ...defaultLocation(), ...data.locations?.hotdog },
        taco: { ...defaultLocation(), ...data.locations?.taco },
      },
    }
    if (merged.totalEarned >= UNLOCK_TACO_TOTAL) {
      merged.tacoUnlocked = true
    }
    if (merged.activeLocation === 'taco' && !merged.tacoUnlocked) {
      merged.activeLocation = 'hotdog'
    }
    return merged
  } catch {
    return defaultState()
  }
}

export function saveState(state) {
  state.lastTimestamp = Date.now()
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

/** @param {ReturnType<typeof defaultState>} state */
export function applyOfflineEarnings(state) {
  const now = Date.now()
  const away = Math.min(
    Math.max(0, now - (state.lastTimestamp || now)),
    OFFLINE_CAP_MS,
  )
  if (away < 1000) {
    return { offlineCoins: 0, awayMs: away }
  }
  const cps = estimateGlobalCoinsPerSecond(state)
  const offlineCoins = Math.floor((away / 1000) * cps)
  if (offlineCoins > 0) {
    state.coins += offlineCoins
  }
  return { offlineCoins, awayMs: away }
}

function coinPerServeForLocation(state, locId) {
  const loc = state.locations[locId]
  const base = locId === 'taco' ? 2 : 1
  return base * Math.pow(2, loc.counterUpgrades ?? 0)
}

export function estimateLocationCoinsPerSecond(state, locId) {
  const loc = state.locations[locId]
  const cpv = coinPerServeForLocation(state, locId)
  let cps = 0
  if (loc.staff) cps += 0.5 * cpv
  cps += 0.25 * 0.55 * cpv
  return cps
}

export function estimateGlobalCoinsPerSecond(state) {
  let sum = estimateLocationCoinsPerSecond(state, 'hotdog')
  if (state.tacoUnlocked) {
    sum += estimateLocationCoinsPerSecond(state, 'taco')
  }
  return sum
}
