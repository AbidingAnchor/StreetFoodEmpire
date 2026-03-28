import { useIdleGame } from './hooks/useIdleGame'
import {
  BUSINESS_DEFS,
  earnRateAtLevel,
  MAX_LEVEL,
  upgradeCostFromLevel,
} from './game/businesses'

function formatCoins(n) {
  const x = Math.floor(n)
  if (x < 1_000_000) return x.toLocaleString()
  if (x < 1_000_000_000) return `${(x / 1_000_000).toFixed(2)}M`
  return `${(x / 1_000_000_000).toFixed(2)}B`
}

function formatRate(n) {
  if (n < 10) return n.toFixed(2)
  if (n < 100) return n.toFixed(1)
  return formatCoins(n)
}

export default function App() {
  const {
    game,
    coinsPerSecond,
    offlinePopupCoins,
    dismissOfflinePopup,
    unlock,
    upgrade,
  } = useIdleGame()

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-orange-700 via-red-600 to-red-800 font-sans text-amber-50">
      {offlinePopupCoins != null && offlinePopupCoins > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-back-title"
        >
          <div className="max-w-sm rounded-3xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-900/95 to-red-900/95 p-6 shadow-2xl shadow-black/40">
            <h2
              id="welcome-back-title"
              className="text-center text-xl font-bold text-amber-200"
            >
              Welcome back!
            </h2>
            <p className="mt-3 text-center text-lg text-amber-50/95">
              You earned{' '}
              <span className="font-bold text-yellow-300">
                {formatCoins(offlinePopupCoins)} coins
              </span>{' '}
              while away 🌮
            </p>
            <button
              type="button"
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 py-3 text-lg font-bold text-red-950 shadow-lg transition hover:brightness-110 active:scale-[0.98]"
              onClick={dismissOfflinePopup}
            >
              Let&apos;s cook!
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 border-b border-amber-500/30 bg-gradient-to-r from-red-900/90 to-orange-900/90 px-4 py-4 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-lg flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide text-amber-200/90">
              Coins
            </span>
            <span className="text-xs text-amber-200/70">per second</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-4xl font-extrabold tracking-tight text-yellow-300 drop-shadow-md sm:text-5xl">
              🪙 {formatCoins(game.coins)}
            </p>
            <p className="text-lg font-bold text-amber-200">
              +{formatRate(coinsPerSecond)}/s
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 pb-28">
        {BUSINESS_DEFS.map((def) => {
          const row = game.businesses.find((b) => b.id === def.id)
          const owned = row?.owned
          const level = row?.level ?? 1

          if (!owned) {
            const canUnlock = game.coins >= def.unlockCost
            return (
              <article
                key={def.id}
                className="rounded-2xl border border-amber-900/40 bg-black/25 p-4 shadow-lg shadow-black/20"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl grayscale opacity-80" aria-hidden>
                    {def.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-amber-100/90">
                      {def.name}
                    </h3>
                    <p className="mt-1 text-sm text-amber-200/80">
                      🔒 Locked — costs{' '}
                      <span className="font-semibold text-yellow-300">
                        {formatCoins(def.unlockCost)} coins
                      </span>{' '}
                      to unlock
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canUnlock}
                  onClick={() => unlock(def.id)}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 py-2.5 text-base font-bold text-red-950 shadow-md transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
                >
                  Unlock — {formatCoins(def.unlockCost)} 🪙
                </button>
              </article>
            )
          }

          const rate = earnRateAtLevel(def, level)
          const atMax = level >= MAX_LEVEL
          const nextCost = atMax ? null : upgradeCostFromLevel(def, level)
          const canUpgrade = !atMax && nextCost != null && game.coins >= nextCost

          return (
            <article
              key={def.id}
              className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/50 to-red-950/50 p-4 shadow-xl shadow-black/25"
            >
              <div className="flex items-start gap-3">
                <span className="text-4xl drop-shadow" aria-hidden>
                  {def.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-amber-50">{def.name}</h3>
                  <p className="mt-1 text-sm text-amber-200/90">
                    Level{' '}
                    <span className="font-bold text-yellow-300">{level}</span>
                    <span className="mx-1 text-amber-500">·</span>
                    <span className="font-semibold text-amber-100">
                      {formatRate(rate)} coins/s
                    </span>
                  </p>
                </div>
              </div>
              {atMax ? (
                <p className="mt-4 text-center text-sm font-semibold text-amber-300/90">
                  Max level — empire tier! 👑
                </p>
              ) : (
                <button
                  type="button"
                  disabled={!canUpgrade}
                  onClick={() => upgrade(def.id)}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-2.5 text-base font-bold text-white shadow-md transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Upgrade — {formatCoins(nextCost)} 🪙
                </button>
              )}
            </article>
          )
        })}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-amber-500/25 bg-gradient-to-r from-red-950/95 to-orange-950/95 py-3 text-center text-sm font-semibold text-amber-200/95 backdrop-blur-md">
        <p>Your Empire Awaits 🌮</p>
      </footer>
    </div>
  )
}
