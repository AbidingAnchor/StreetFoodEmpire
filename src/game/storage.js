import {
  BUSINESS_DEFS,
  defaultBusinessRows,
  totalCoinsPerSecond,
} from './businesses'

export const STORAGE_KEY = 'street-food-empire-save'
export const SAVE_VERSION = 1
export const OFFLINE_CAP_MS = 4 * 60 * 60 * 1000

export function defaultGameState() {
  const now = Date.now()
  return {
    version: SAVE_VERSION,
    coins: 0,
    totalEarned: 0,
    lastOnline: now,
    businesses: defaultBusinessRows(),
  }
}

function normalizeBusinesses(raw) {
  const byId = new Map(
    Array.isArray(raw) ? raw.map((r) => [r.id, r]) : [],
  )
  return BUSINESS_DEFS.map((def) => {
    const row = byId.get(def.id)
    const owned = row?.owned ?? def.unlockCost === 0
    let level = Number(row?.level) || 1
    if (level < 1) level = 1
    if (level > 10) level = 10
    return { id: def.id, owned, level }
  })
}

export function parseSaved(json) {
  const base = defaultGameState()
  if (!json || typeof json !== 'object') return base
  return {
    version: SAVE_VERSION,
    coins: Math.max(0, Number(json.coins) || 0),
    totalEarned: Math.max(0, Number(json.totalEarned) || 0),
    lastOnline: Number(json.lastOnline) || Date.now(),
    businesses: normalizeBusinesses(json.businesses),
  }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultGameState()
    return parseSaved(JSON.parse(raw))
  } catch {
    return defaultGameState()
  }
}

export function saveToLocalStorage(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        coins: state.coins,
        totalEarned: state.totalEarned,
        lastOnline: state.lastOnline,
        businesses: state.businesses,
      }),
    )
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Apply offline earnings from persisted state; returns new game state and coins earned this session.
 */
export function hydrateWithOffline(saved) {
  const now = Date.now()
  const prevLast = Number(saved.lastOnline) || now
  const elapsed = Math.max(0, Math.min(now - prevLast, OFFLINE_CAP_MS))
  const cps = totalCoinsPerSecond(saved.businesses)
  const offlineEarned = Math.floor((elapsed / 1000) * cps)
  return {
    game: {
      ...saved,
      coins: saved.coins + offlineEarned,
      totalEarned: saved.totalEarned + offlineEarned,
      lastOnline: now,
    },
    offlineEarned,
  }
}
