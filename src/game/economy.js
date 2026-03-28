export const COST_STAFF = 500
export const COST_COUNTER = 1000
export const COST_PATIENCE = 800
export const UNLOCK_TACO_TOTAL = 5000

export const BASE_SERVE_SECONDS = 1
export const SERVE_TIME_MIN = 0.2
export const SERVE_TIME_STEP = 0.2

export const BASE_PATIENCE_SECONDS = 12
export const PATIENCE_STEP_SECONDS = 3

export const STAFF_SERVE_INTERVAL_MS = 2000
export const COIN_BAG_LIFETIME_MS = 3000

export function serveDurationSeconds(counterUpgrades) {
  return Math.max(
    SERVE_TIME_MIN,
    BASE_SERVE_SECONDS - SERVE_TIME_STEP * counterUpgrades,
  )
}

export function patienceSeconds(patienceUpgrades) {
  return BASE_PATIENCE_SECONDS + PATIENCE_STEP_SECONDS * patienceUpgrades
}

export function formatCoins(n) {
  const x = Math.floor(n)
  if (x < 1_000_000) return x.toLocaleString()
  if (x < 1_000_000_000) return `${(x / 1_000_000).toFixed(2)}M`
  return `${(x / 1_000_000_000).toFixed(2)}B`
}

export function formatRate(n) {
  if (n < 10) return n.toFixed(2)
  if (n < 100) return n.toFixed(1)
  return formatCoins(n)
}
