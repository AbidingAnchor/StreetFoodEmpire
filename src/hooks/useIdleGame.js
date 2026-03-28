import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getDef,
  MAX_LEVEL,
  totalCoinsPerSecond,
  upgradeCostFromLevel,
} from '../game/businesses'
import {
  hydrateWithOffline,
  loadFromLocalStorage,
  saveToLocalStorage,
} from '../game/storage'

const WELCOME_KEY = 'sfe-pending-welcome'

let initialGameCache

function getInitialGame() {
  if (initialGameCache !== undefined) return initialGameCache
  const saved = loadFromLocalStorage()
  const { game: next, offlineEarned } = hydrateWithOffline(saved)
  saveToLocalStorage(next)
  if (offlineEarned > 0) {
    try {
      sessionStorage.setItem(WELCOME_KEY, String(offlineEarned))
    } catch {
      /* private mode */
    }
  }
  initialGameCache = next
  return next
}

function getInitialWelcomeCoins() {
  try {
    const raw = sessionStorage.getItem(WELCOME_KEY)
    const n = raw ? Number(raw) : 0
    return n > 0 ? n : null
  } catch {
    return null
  }
}

export function useIdleGame() {
  const [game, setGame] = useState(getInitialGame)
  const [offlinePopupCoins, setOfflinePopupCoins] = useState(getInitialWelcomeCoins)

  const dismissOfflinePopup = useCallback(() => {
    try {
      sessionStorage.removeItem(WELCOME_KEY)
    } catch {
      /* ignore */
    }
    setOfflinePopupCoins(null)
  }, [])

  const tickRef = useRef(0)
  useEffect(() => {
    tickRef.current = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = (now - tickRef.current) / 1000
      tickRef.current = now
      if (dt <= 0 || dt > 5) return

      setGame((g) => {
        const cps = totalCoinsPerSecond(g.businesses)
        const gain = cps * dt
        return {
          ...g,
          coins: g.coins + gain,
          totalEarned: g.totalEarned + gain,
          lastOnline: Date.now(),
        }
      })
    }, 200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => saveToLocalStorage(game), 0)
    return () => clearTimeout(t)
  }, [game])

  useEffect(() => {
    const persist = () => saveToLocalStorage(game)
    const onVis = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [game])

  const coinsPerSecond = totalCoinsPerSecond(game.businesses)

  const unlock = useCallback((businessId) => {
    const def = getDef(businessId)
    if (!def || def.unlockCost <= 0) return
    setGame((g) => {
      const row = g.businesses.find((b) => b.id === businessId)
      if (!row || row.owned || g.coins < def.unlockCost) return g
      return {
        ...g,
        coins: g.coins - def.unlockCost,
        businesses: g.businesses.map((b) =>
          b.id === businessId ? { ...b, owned: true, level: 1 } : b,
        ),
        lastOnline: Date.now(),
      }
    })
  }, [])

  const upgrade = useCallback((businessId) => {
    setGame((g) => {
      const row = g.businesses.find((b) => b.id === businessId)
      const def = getDef(businessId)
      if (!row || !row.owned || !def) return g
      if (row.level >= MAX_LEVEL) return g
      const cost = upgradeCostFromLevel(def, row.level)
      if (g.coins < cost) return g
      return {
        ...g,
        coins: g.coins - cost,
        businesses: g.businesses.map((b) =>
          b.id === businessId ? { ...b, level: b.level + 1 } : b,
        ),
        lastOnline: Date.now(),
      }
    })
  }, [])

  return {
    game,
    coinsPerSecond,
    offlinePopupCoins,
    dismissOfflinePopup,
    unlock,
    upgrade,
  }
}
