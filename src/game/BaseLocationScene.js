import Phaser from 'phaser'
import {
  COST_COUNTER,
  COST_PATIENCE,
  COST_STAFF,
  COIN_BAG_LIFETIME_MS,
  STAFF_SERVE_INTERVAL_MS,
  UNLOCK_TACO_TOTAL,
  patienceSeconds,
  serveDurationSeconds,
} from './economy.js'
import { estimateGlobalCoinsPerSecond, saveState } from './save.js'

const THEMES = {
  hotdog: {
    floor: 0xffe8cc,
    stripe: 0xffcfa3,
    wall: 0xfdba74,
    counter: 0xea580c,
    counterTop: 0xfef3c7,
    register: 0x1e293b,
    queuePad: 0xfde68a,
    pickupPad: 0xfecaca,
  },
  taco: {
    floor: 0xd9f99d,
    stripe: 0xbef264,
    wall: 0x86efac,
    counter: 0x15803d,
    counterTop: 0xfef08a,
    register: 0x14532d,
    queuePad: 0xfef9c3,
    pickupPad: 0xffedd5,
  },
}

const MAX_QUEUE = 6
const SPAWN_MIN = 3000
const SPAWN_MAX = 5000

function randomPastel() {
  const hues = [0xff6b9d, 0x60a5fa, 0xa78bfa, 0x34d399, 0xfbbf24, 0xf472b6]
  return Phaser.Utils.Array.GetRandom(hues)
}

export class BaseLocationScene extends Phaser.Scene {
  /**
   * @param {string} sceneKey
   * @param {'hotdog' | 'taco'} locId
   */
  constructor(sceneKey, locId) {
    super(sceneKey)
    this.locId = locId
  }

  create() {
    this.theme = THEMES[this.locId]
    this.state = this.game.registry.get('state')
    this.queue = []
    this.coinBags = []
    this.serving = false
    this.spawnTimer = null
    this.staffEvent = null
    this.persistTimer = 0
    this.counterZone = null
    this.modalBlock = false

    this.drawScene()
    this.setupCounterInput()
    this.setupButtons()
    this.scheduleSpawn()
    this.setupStaffTimer()

    this.events.once('shutdown', () => {
      if (this.spawnTimer) this.spawnTimer.remove()
      if (this.staffEvent) this.staffEvent.remove()
    })

    const pendingOffline = this.game.registry.get('pendingOfflineCoins') ?? 0
    if (pendingOffline > 0) {
      this.game.registry.set('pendingOfflineCoins', 0)
      this.queuePersist()
      this.showModal(
        'Welcome back!',
        `You earned ${pendingOffline.toLocaleString()} coins 🌮`,
        () => this.checkTacoPopupOnBoot(),
      )
    } else {
      this.time.delayedCall(80, () => this.checkTacoPopupOnBoot())
    }

    this.notifyHud()
  }

  checkTacoPopupOnBoot() {
    const s = this.state
    if (s.tacoUnlocked && !s.tacoUnlockPopupShown) {
      this.showModal('New Location Unlocked! 🌮', 'Taco Stand is ready — tap the tab below to visit!', () => {
        s.tacoUnlockPopupShown = true
        this.queuePersist()
        const fn = this.game.registry.get('onTacoUnlocked')
        if (typeof fn === 'function') fn()
      })
    }
  }

  getLoc() {
    return this.state.locations[this.locId]
  }

  coinValue() {
    const base = this.locId === 'taco' ? 2 : 1
    const u = this.getLoc().counterUpgrades ?? 0
    return base * Math.pow(2, u)
  }

  queuePersist() {
    saveState(this.state)
  }

  debouncedPersist() {
    this.persistTimer = (this.persistTimer || 0) + 1
    const id = this.persistTimer
    this.time.delayedCall(200, () => {
      if (id === this.persistTimer) this.queuePersist()
    })
  }

  notifyHud() {
    if (this.registerCoinLabel) {
      this.registerCoinLabel.setText(String(Math.floor(this.state.coins)))
    }
    const fn = this.game.registry.get('onHudUpdate')
    if (typeof fn !== 'function') return
    const cps = estimateGlobalCoinsPerSecond(this.state)
    fn(this.state.coins, cps)
  }

  drawScene() {
    const w = this.scale.width
    const h = this.scale.height
    this.cameras.main.setBackgroundColor(this.theme.floor)

    this.bgGraphics = this.add.graphics()
    this.drawBackground(this.bgGraphics, w, h)

    this.counterY = h * 0.52
    this.counterX = w * 0.5
    this.queueBaseX = w * 0.14
    this.queueY = this.counterY
    this.slotGap = Math.min(52, w * 0.1)
    this.pickupX = w * 0.82
    this.pickupY = this.counterY

    this.drawCounter(w)
    this.drawRegister()
    this.drawZonePads(w)

    this.serveGlow = this.add.graphics()
    this.serveGlow.setDepth(5)
    this.serveGlow.setAlpha(0)
  }

  drawBackground(g, w, h) {
    g.clear()
    g.fillStyle(this.theme.floor, 1)
    g.fillRect(0, 0, w, h)
    g.fillStyle(this.theme.stripe, 0.35)
    const stripe = 28
    for (let y = 0; y < h; y += stripe * 2) {
      g.fillRect(0, y, w, stripe)
    }
    g.fillStyle(this.theme.wall, 1)
    g.fillRoundedRect(0, 0, w, h * 0.22, 0)
  }

  drawCounter(w) {
    const g = this.add.graphics()
    g.setDepth(2)
    const cw = Math.min(w * 0.42, 200)
    const ch = 72
    const cx = this.counterX
    const cy = this.counterY
    g.fillStyle(this.theme.counter, 1)
    g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 16)
    g.fillStyle(this.theme.counterTop, 1)
    g.fillRoundedRect(cx - cw / 2 - 6, cy - ch / 2 - 14, cw + 12, 22, 10)
    g.lineStyle(3, 0xffffff, 0.25)
    g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 16)
    this.counterHalfW = cw / 2
    this.counterHalfH = ch / 2
  }

  drawRegister() {
    const g = this.add.graphics()
    g.setDepth(3)
    const rx = this.counterX + this.counterHalfW - 28
    const ry = this.counterY - this.counterHalfH - 6
    g.fillStyle(this.theme.register, 1)
    g.fillRoundedRect(rx - 36, ry - 28, 72, 56, 10)
    g.fillStyle(0x22c55e, 1)
    g.fillRoundedRect(rx - 24, ry - 14, 48, 18, 6)
    this.registerText = this.add
      .text(rx, ry - 6, 'OPEN', {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '11px',
        color: '#ecfdf5',
      })
      .setOrigin(0.5)
      .setDepth(4)
    this.registerCoinLabel = this.add
      .text(rx, ry + 14, '0', {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '13px',
        color: '#fef3c7',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(4)
  }

  drawZonePads(w) {
    const g = this.add.graphics()
    g.setDepth(1)
    const padH = 100
    const padY = this.counterY - padH / 2
    g.fillStyle(this.theme.queuePad, 0.55)
    g.fillRoundedRect(8, padY, w * 0.26, padH, 20)
    g.fillStyle(this.theme.pickupPad, 0.55)
    g.fillRoundedRect(w * 0.7 - 8, padY, w * 0.28, padH, 20)

    this.add
      .text(w * 0.17, padY + padH + 14, 'Queue', {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '14px',
        color: '#7c2d12',
      })
      .setOrigin(0.5, 0)
      .setDepth(2)

    this.add
      .text(w * 0.84, padY + padH + 14, 'Pickup', {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '14px',
        color: '#7c2d12',
      })
      .setOrigin(0.5, 0)
      .setDepth(2)
  }

  setupCounterInput() {
    const w = this.scale.width
    const zoneW = Math.min(w * 0.48, 240)
    const zoneH = 100
    if (this.counterZone) this.counterZone.destroy()
    this.counterZone = this.add
      .zone(this.counterX, this.counterY, zoneW, zoneH)
      .setDepth(20)
      .setInteractive({ useHandCursor: true })
    this.counterZone.on('pointerdown', () => {
      if (this.modalBlock) return
      this.tryServeManual()
    })
  }

  tryServeManual() {
    if (this.serving) return
    if (this.queue.length === 0) return
    this.startServeNext()
  }

  setupStaffTimer() {
    if (this.staffEvent) {
      this.staffEvent.remove()
      this.staffEvent = null
    }
    this.staffEvent = this.time.addEvent({
      delay: STAFF_SERVE_INTERVAL_MS,
      loop: true,
      callback: () => {
        if (this.modalBlock) return
        if (!this.getLoc().staff) return
        if (this.serving) return
        if (this.queue.length === 0) return
        this.startServeNext()
      },
    })
  }

  scheduleSpawn() {
    if (this.spawnTimer) this.spawnTimer.remove()
    const delay = Phaser.Math.Between(SPAWN_MIN, SPAWN_MAX)
    this.spawnTimer = this.time.delayedCall(delay, () => {
      this.trySpawnCustomer()
      this.scheduleSpawn()
    })
  }

  trySpawnCustomer() {
    if (this.modalBlock) return
    if (this.queue.length >= MAX_QUEUE) return
    this.spawnCustomer()
  }

  spawnCustomer() {
    const slot = this.queue.length
    const tx = this.queueBaseX + slot * this.slotGap
    const patience = patienceSeconds(this.getLoc().patienceUpgrades ?? 0)
    const cust = this.makeCustomer(-40, this.queueY, patience)
    cust.targetX = tx
    cust.targetY = this.queueY
    cust.state = 'walk'
    this.queue.push(cust)
    this.tweens.add({
      targets: cust.container,
      x: tx,
      duration: 600 + slot * 80,
      ease: 'Sine.easeOut',
      onComplete: () => {
        cust.state = 'queued'
      },
    })
  }

  makeCustomer(x, y, patienceMax) {
    const shirt = randomPastel()
    const container = this.add.container(x, y)
    container.setDepth(10)

    const shadow = this.add.graphics()
    shadow.fillStyle(0x000000, 0.15)
    shadow.fillEllipse(0, 22, 26, 10)

    const body = this.add.graphics()
    body.fillStyle(shirt, 1)
    body.fillCircle(0, 6, 16)
    body.fillStyle(0xffedd5, 1)
    body.fillCircle(0, -14, 12)

    const eyes = this.add.graphics()
    eyes.fillStyle(0x1e293b, 1)
    eyes.fillCircle(-4, -16, 2)
    eyes.fillCircle(4, -16, 2)

    const barBg = this.add.graphics()
    const barW = 44
    const barH = 7
    barBg.fillStyle(0x1e293b, 0.55)
    barBg.fillRoundedRect(-barW / 2, -40, barW, barH, 4)

    const barFg = this.add.graphics()

    container.add([shadow, body, eyes, barBg, barFg])

    return {
      container,
      barFg,
      barW,
      barH,
      patienceMax,
      patienceLeft: patienceMax,
      state: 'walk',
      shirt,
    }
  }

  updatePatienceBar(cust) {
    const ratio = Phaser.Math.Clamp(cust.patienceLeft / cust.patienceMax, 0, 1)
    const barW = cust.barW * ratio
    const g = cust.barFg
    g.clear()
    let col = 0x22c55e
    if (ratio < 0.33) col = 0xef4444
    else if (ratio < 0.66) col = 0xeab308
    g.fillStyle(col, 1)
    if (barW > 0.5) {
      g.fillRoundedRect(-cust.barW / 2, -40, barW, cust.barH, 3)
    }
  }

  relayoutQueuePositions() {
    this.queue.forEach((cust, i) => {
      if (cust.state !== 'queued') return
      const tx = this.queueBaseX + i * this.slotGap
      this.tweens.add({
        targets: cust.container,
        x: tx,
        duration: 220,
        ease: 'Sine.easeOut',
      })
    })
  }

  startServeNext() {
    const cust = this.queue.find((c) => c.state === 'queued')
    if (!cust) return
    this.serving = true
    const idx = this.queue.indexOf(cust)
    if (idx >= 0) this.queue.splice(idx, 1)
    this.relayoutQueuePositions()

    cust.state = 'serving'
    const loc = this.getLoc()
    const serveSec = serveDurationSeconds(loc.counterUpgrades ?? 0)
    const serveMs = serveSec * 1000
    const t1 = serveMs * 0.22
    const t2 = serveMs * 0.48
    const t3 = serveMs * 0.3

    this.tweens.add({
      targets: cust.container,
      x: this.counterX,
      y: this.counterY - 8,
      duration: t1,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.flashServeGlow(t2)
      },
    })

    this.time.delayedCall(t1 + t2, () => {
      const value = this.coinValue()
      this.tweens.add({
        targets: cust.container,
        x: this.pickupX,
        y: this.pickupY,
        duration: t3,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.spawnCoinBag(this.pickupX, this.pickupY - 40, value)
          this.tweens.add({
            targets: cust.container,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              cust.container.destroy()
            },
          })
          this.serving = false
        },
      })
    })
  }

  flashServeGlow(duration) {
    const g = this.serveGlow
    g.clear()
    g.fillStyle(0xfef08a, 0.45)
    g.fillCircle(this.counterX, this.counterY - 10, 48)
    this.tweens.add({
      targets: g,
      alpha: 1,
      duration: duration * 0.35,
      yoyo: true,
      onComplete: () => {
        g.clear()
        g.setAlpha(0)
      },
    })
  }

  spawnCoinBag(x, y, value) {
    const bag = this.add.container(x, y)
    bag.setDepth(25)
    const g = this.add.graphics()
    g.fillStyle(0xfacc15, 1)
    g.fillRoundedRect(-22, -26, 44, 48, 10)
    g.lineStyle(2, 0xd97706, 1)
    g.strokeRoundedRect(-22, -26, 44, 48, 10)
    g.fillStyle(0xb45309, 1)
    g.fillRoundedRect(-10, -34, 20, 12, 4)
    const label = this.add
      .text(0, 0, `+${value}`, {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '16px',
        color: '#422006',
        fontStyle: '700',
      })
      .setOrigin(0.5)
    bag.add([g, label])
    bag.setSize(50, 56)
    bag.setInteractive(
      new Phaser.Geom.Rectangle(-25, -36, 50, 56),
      Phaser.Geom.Rectangle.Contains,
    )
    bag.setScale(0.85)

    const entry = { bag, value, destroyTimer: null }
    entry.destroyTimer = this.time.delayedCall(COIN_BAG_LIFETIME_MS, () => {
      if (bag.active) {
        this.tweens.add({
          targets: bag,
          alpha: 0,
          scale: 0.4,
          duration: 180,
          onComplete: () => bag.destroy(),
        })
      }
      this.coinBags = this.coinBags.filter((b) => b !== entry)
    })

    bag.on('pointerdown', () => {
      if (this.modalBlock) return
      if (entry.destroyTimer) entry.destroyTimer.remove()
      this.collectBag(entry)
    })

    this.tweens.add({
      targets: bag,
      scale: 1,
      duration: 160,
      ease: 'Back.easeOut',
    })

    this.coinBags.push(entry)
  }

  collectBag(entry) {
    const { bag, value } = entry
    if (!bag.active) return
    this.coinBags = this.coinBags.filter((b) => b !== entry)
    this.state.coins += value
    this.state.totalEarned += value
    this.maybeUnlockTaco()
    this.debouncedPersist()
    this.notifyHud()
    this.tweens.add({
      targets: bag,
      y: bag.y - 30,
      alpha: 0,
      scale: 1.15,
      duration: 200,
      onComplete: () => bag.destroy(),
    })
  }

  maybeUnlockTaco() {
    const s = this.state
    if (s.tacoUnlocked) return
    if (s.totalEarned < UNLOCK_TACO_TOTAL) return
    s.tacoUnlocked = true
    this.debouncedPersist()
    const fn = this.game.registry.get('onTacoUnlocked')
    if (typeof fn === 'function') fn()
    this.showModal('New Location Unlocked! 🌮', 'Taco Stand is ready — tap the tab below to visit!', () => {
      s.tacoUnlockPopupShown = true
      this.queuePersist()
    })
  }

  showModal(title, body, onClose) {
    this.modalBlock = true
    const w = this.scale.width
    const h = this.scale.height
    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 0.5)
    overlay.fillRect(0, 0, w, h)
    overlay.setDepth(1000)
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    )

    const panelW = Math.min(w - 36, 320)
    const panelH = 200
    const panel = this.add.graphics()
    panel.setDepth(1001)
    panel.fillStyle(0xfff7ed, 1)
    panel.fillRoundedRect(w / 2 - panelW / 2, h / 2 - panelH / 2, panelW, panelH, 22)
    panel.lineStyle(4, 0xfbbf24, 1)
    panel.strokeRoundedRect(w / 2 - panelW / 2, h / 2 - panelH / 2, panelW, panelH, 22)

    const titleText = this.add
      .text(w / 2, h / 2 - 58, title, {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '22px',
        color: '#9a3412',
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: panelW - 28 },
      })
      .setOrigin(0.5)
      .setDepth(1002)

    const bodyText = this.add
      .text(w / 2, h / 2 - 8, body, {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '17px',
        color: '#431407',
        align: 'center',
        wordWrap: { width: panelW - 28 },
      })
      .setOrigin(0.5)
      .setDepth(1002)

    const hint = this.add
      .text(w / 2, h / 2 + 62, 'Tap anywhere to continue', {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '14px',
        color: '#b45309',
      })
      .setOrigin(0.5)
      .setDepth(1002)

    const close = () => {
      overlay.destroy()
      panel.destroy()
      titleText.destroy()
      bodyText.destroy()
      hint.destroy()
      this.modalBlock = false
      onClose()
    }

    overlay.once('pointerdown', close)
  }

  setupButtons() {
    this.btnContainers = []
    this.layoutButtons()
  }

  layoutButtons() {
    const w = this.scale.width
    const h = this.scale.height
    const labels = [
      { id: 'staff', text: () => `Hire Staff — ${COST_STAFF} 🪙` },
      { id: 'counter', text: () => `Upgrade Counter — ${COST_COUNTER} 🪙` },
      { id: 'patience', text: () => `Upgrade Patience — ${COST_PATIENCE} 🪙` },
    ]
    if (!this.buttonTexts) this.buttonTexts = {}
    const gap = 8
    const btnW = (w - gap * 4) / 3
    const btnH = 44
    const y = h - btnH - 18

    labels.forEach((def, i) => {
      const x = gap + i * (btnW + gap) + btnW / 2
      let c = this.btnContainers[i]
      if (!c) {
        c = this.add.container(x, y)
        c.setDepth(30)
        const bg = this.add.graphics()
        const hit = this.add.zone(0, 0, btnW, btnH)
        hit.setInteractive({ useHandCursor: true })
        const txt = this.add
          .text(0, 0, '', {
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontSize: '11px',
            color: '#fffbeb',
            fontStyle: '700',
            align: 'center',
            wordWrap: { width: btnW - 8 },
          })
          .setOrigin(0.5)
        c.add([bg, hit, txt])
        c.setData('bg', bg)
        c.setData('hit', hit)
        c.setData('txt', txt)
        hit.on('pointerdown', () => {
          if (this.modalBlock) return
          this.onShopButton(def.id)
        })
        this.btnContainers[i] = c
        this.buttonTexts[def.id] = txt
      } else {
        c.setPosition(x, y)
        c.getData('hit').setSize(btnW, btnH)
      }
      const txt = c.getData('txt')
      txt.setText(def.text())
      this.paintShopButton(c, btnW, btnH, def.id)
    })
  }

  paintShopButton(container, btnW, btnH, id) {
    const bg = container.getData('bg')
    const txt = container.getData('txt')
    const hit = container.getData('hit')
    const loc = this.getLoc()
    let affordable = false
    let hired = false
    if (id === 'staff') {
      hired = !!loc.staff
      affordable = this.state.coins >= COST_STAFF
    } else if (id === 'counter') {
      affordable = this.state.coins >= COST_COUNTER
    } else if (id === 'patience') {
      affordable = this.state.coins >= COST_PATIENCE
    }
    bg.clear()
    if (id === 'staff' && hired) {
      txt.setText('Staff hired ✓')
      txt.setStyle({ fill: '#fffbeb' })
      container.setAlpha(1)
      hit.disableInteractive()
      bg.fillStyle(0x65a30d, 1)
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
      bg.lineStyle(2, 0xffffff, 0.25)
      bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
      return
    }
    container.setAlpha(1)
    hit.setInteractive({ useHandCursor: true })
    const fill = affordable ? 0xea580c : 0x78716c
    bg.fillStyle(fill, 1)
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
    bg.lineStyle(2, 0xffffff, 0.25)
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
  }

  onShopButton(id) {
    const loc = this.getLoc()
    if (id === 'staff') {
      if (loc.staff) return
      if (this.state.coins < COST_STAFF) return
      this.state.coins -= COST_STAFF
      loc.staff = true
      this.setupStaffTimer()
    } else if (id === 'counter') {
      if (this.state.coins < COST_COUNTER) return
      this.state.coins -= COST_COUNTER
      loc.counterUpgrades = (loc.counterUpgrades ?? 0) + 1
    } else if (id === 'patience') {
      if (this.state.coins < COST_PATIENCE) return
      this.state.coins -= COST_PATIENCE
      loc.patienceUpgrades = (loc.patienceUpgrades ?? 0) + 1
    }
    this.queuePersist()
    this.notifyHud()
    this.layoutButtons()
  }

  update(_t, dt) {
    if (this.modalBlock) return
    const ds = dt / 1000
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const cust = this.queue[i]
      if (cust.state !== 'queued') continue
      cust.patienceLeft -= ds
      this.updatePatienceBar(cust)
      if (cust.patienceLeft <= 0) {
        this.queue.splice(i, 1)
        this.tweens.add({
          targets: cust.container,
          x: cust.container.x - 120,
          alpha: 0,
          duration: 350,
          ease: 'Sine.easeIn',
          onComplete: () => cust.container.destroy(),
        })
        this.relayoutQueuePositions()
      }
    }
  }
}
