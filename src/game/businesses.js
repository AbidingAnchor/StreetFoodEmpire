export const MAX_LEVEL = 10

export const BUSINESS_DEFS = [
  {
    id: 'hotdog',
    emoji: '🌭',
    name: 'Hot Dog Cart',
    baseEarn: 1,
    unlockCost: 0,
    firstUpgradeCost: 10,
  },
  {
    id: 'taco',
    emoji: '🌮',
    name: 'Taco Stand',
    baseEarn: 5,
    unlockCost: 100,
    firstUpgradeCost: 50,
  },
  {
    id: 'burger',
    emoji: '🍔',
    name: 'Burger Truck',
    baseEarn: 20,
    unlockCost: 500,
    firstUpgradeCost: 250,
  },
  {
    id: 'pizza',
    emoji: '🍕',
    name: 'Pizza Van',
    baseEarn: 80,
    unlockCost: 2000,
    firstUpgradeCost: 1000,
  },
  {
    id: 'seafood',
    emoji: '🦞',
    name: 'Seafood Shack',
    baseEarn: 300,
    unlockCost: 8000,
    firstUpgradeCost: 4000,
  },
  {
    id: 'restaurant',
    emoji: '🏪',
    name: 'Fast Food Restaurant',
    baseEarn: 1000,
    unlockCost: 30000,
    firstUpgradeCost: 15000,
  },
]

export function getDef(id) {
  return BUSINESS_DEFS.find((b) => b.id === id)
}

/** Earn rate (coins/sec) at level 1..MAX_LEVEL; level doubles from base each step */
export function earnRateAtLevel(def, level) {
  if (!def || level < 1) return 0
  return def.baseEarn * 2 ** (level - 1)
}

/** Cost to upgrade from `level` to level+1 (level 1..9) */
export function upgradeCostFromLevel(def, level) {
  if (!def || level < 1 || level >= MAX_LEVEL) return Infinity
  return def.firstUpgradeCost * 2 ** (level - 1)
}

export function totalCoinsPerSecond(businesses) {
  let total = 0
  for (const row of businesses) {
    if (!row.owned) continue
    const def = getDef(row.id)
    total += earnRateAtLevel(def, row.level)
  }
  return total
}

export function defaultBusinessRows() {
  return BUSINESS_DEFS.map((def) => ({
    id: def.id,
    owned: def.unlockCost === 0,
    level: def.unlockCost === 0 ? 1 : 1,
  }))
}
