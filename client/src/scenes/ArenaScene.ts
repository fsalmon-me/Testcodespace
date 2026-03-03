import Phaser from 'phaser'
import io from 'socket.io-client'
import { ShapeFactory } from '../engine/shapeFactory'
import Player from '../entities/Player'
import Bot from '../entities/Bot'

type RemotePlayer = {
  id: string
  x: number
  y: number
  color: number
  targetX: number
  targetY: number
  drawX: number
  drawY: number
  lastSeqAck?: number
  score?: number
}

export default class ArenaScene extends Phaser.Scene {
  socket: any
  cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null
  localId: string | null = null
  players: Map<string, RemotePlayer> = new Map()
  graphicsMap: Map<string, Phaser.GameObjects.Graphics> = new Map()
  pickupsMap: Map<string, Phaser.GameObjects.Graphics> = new Map()
  particles: Phaser.GameObjects.Particles.ParticleEmitterManager | null = null
  scoreboardText: Phaser.GameObjects.Text | null = null
  pingText: Phaser.GameObjects.Text | null = null
  lastPing = 0
  localPlayer: Player | null = null
  bots: Map<string, Bot> = new Map()
  isSolo = false

  constructor() {
    super({ key: 'ArenaScene' })
  }

  preload() {}

  create() {
    this.cursors = this.input.keyboard.createCursorKeys()

    // create simple title and menu buttons
    const title = this.add.text(480, 80, 'Shapes Arena', { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5)
    const soloBtn = this.add.text(480, 180, 'Solo', { fontSize: '28px', color: '#00ff88', backgroundColor: '#222222' }).setInteractive().setOrigin(0.5)
    const multiBtn = this.add.text(480, 240, 'Multijoueur', { fontSize: '28px', color: '#88bbff', backgroundColor: '#222222' }).setInteractive().setOrigin(0.5)
    const info = this.add.text(480, 320, 'Appuyez sur S pour toggle solo après démarrage', { fontSize: '14px', color: '#cccccc' }).setOrigin(0.5)

    const hideMenu = () => {
      title.setVisible(false)
      soloBtn.setVisible(false)
      multiBtn.setVisible(false)
      info.setVisible(false)
    }

    soloBtn.on('pointerdown', () => {
      hideMenu()
      this.isSolo = true
      this.localPlayer = new Player(this, 'local', 480, 320, 0xff88aa)
      this.spawnBots(3)
    })

    multiBtn.on('pointerdown', () => {
      hideMenu()
      this.isSolo = false
      this.startMultiplayer()
    })

    // local placeholder until server sends state
    this.cameras.main.setBackgroundColor('#0f1720')

    // create some decorative shapes
    for (let i = 0; i < 8; i++) {
      const s = ShapeFactory.randomStatic(this, 100 + i * 90, 80 + (i % 4) * 100)
      this.add.existing(s)
    }

    // scoreboard
    this.scoreboardText = this.add.text(16, 16, '', { fontSize: '16px', color: '#ffffff' })
    this.pingText = this.add.text(16, 40, '', { fontSize: '14px', color: '#cccccc' })
      // ping/RTT
      if (this.socket) {
        setInterval(() => {
          const t0 = performance.now()
          this.socket.emit('ping', t0)
        }, 1000)
        this.socket.on('pong', (t0: number) => {
          const rtt = Math.round(performance.now() - t0)
          this.lastPing = rtt
        })
      }
  }

  startMultiplayer() {
    this.socket = io()

    this.socket.on('connect', () => {
      console.log('connected', this.socket.id)
      this.localId = this.socket.id
      this.localPlayer = new Player(this, this.localId, 480, 320, 0xff88aa)
    })

    this.socket.on('state', (state: any) => {
      this.syncState(state.players)
      this.syncPickups(state.pickups)
    })

    this.socket.on('spawn', (p: any) => {
      this.addOrUpdatePlayer(p.id, p.x, p.y, p.color)
    })

    this.socket.on('despawn', (id: string) => {
      this.removePlayer(id)
    })

    this.socket.on('pickupSpawn', (p: any) => {
      this.syncPickupSpawn(p)
    })

    this.socket.on('pickupCollected', (data: any) => {
      this.playPickupEffect(data.x, data.y, data.type)
      if (data.by === this.socket.id && data.type === 'speed' && this.localPlayer) {
        this.localPlayer.activateSpeedBoost(3000)
      }
    })
  }

  syncState(players: any) {
    // update existing and add new
    for (const id in players) {
      const p = players[id]
      this.addOrUpdatePlayer(id, p.x, p.y, p.color, p.lastSeqAck, p.score)
    }
    // remove missing
    const serverIds = new Set(Object.keys(players))
    for (const id of Array.from(this.players.keys())) {
      if (!serverIds.has(id)) this.removePlayer(id)
    }
  }

  addOrUpdatePlayer(id: string, x: number, y: number, color: number, lastSeqAck?: number, score?: number) {
    const existing = this.players.get(id)
    if (!existing) {
      const rp: RemotePlayer = { id, x, y, color, targetX: x, targetY: y, drawX: x, drawY: y, lastSeqAck, score }
      this.players.set(id, rp)
      // create graphics
      const g = this.add.graphics({ x: 0, y: 0 })
      this.graphicsMap.set(id, g)
    } else {
      existing.targetX = x
      existing.targetY = y
      if (lastSeqAck !== undefined) existing.lastSeqAck = lastSeqAck
      existing.x = x
      existing.y = y
      if (score !== undefined) existing.score = score
    }

    // if server update for local player, reconcile
    if (this.localPlayer && id === this.localPlayer.id) {
      const lastSeq = lastSeqAck || 0
      this.localPlayer.reconcile(x, y, lastSeq)
    }
  }

  removePlayer(id: string) {
    this.players.delete(id)
    const g = this.graphicsMap.get(id)
    if (g) g.destroy()
    this.graphicsMap.delete(id)
  }

  syncPickups(pickups: any) {
    if (!pickups) return
    const ids = new Set(Object.keys(pickups))
    for (const id in pickups) this.syncPickupSpawn(pickups[id])
    for (const id of Array.from(this.pickupsMap.keys())) {
      if (!ids.has(id)) {
        const g = this.pickupsMap.get(id)
        if (g) g.destroy()
        this.pickupsMap.delete(id)
      }
    }
  }

  syncPickupSpawn(p: any) {
    const existing = this.pickupsMap.get(p.id)
    if (!existing) {
      const g = this.add.graphics()
      if (p.type === 'speed') {
        g.lineStyle(2, 0x00ffff, 1)
        g.strokeCircle(p.x, p.y, 14)
        g.fillStyle(p.color, 1)
        g.fillCircle(p.x, p.y, 10)
      } else {
        g.fillStyle(p.color, 1)
        g.fillCircle(p.x, p.y, 10)
      }
      this.pickupsMap.set(p.id, g)
    } else {
      existing.clear()
      if (p.type === 'speed') {
        existing.lineStyle(2, 0x00ffff, 1)
        existing.strokeCircle(p.x, p.y, 14)
        existing.fillStyle(p.color, 1)
        existing.fillCircle(p.x, p.y, 10)
      } else {
        existing.fillStyle(p.color, 1)
        existing.fillCircle(p.x, p.y, 10)
      }
    }
  }

  playPickupEffect(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const g = this.add.graphics()
      const c = Phaser.Display.Color.RandomRGB().color
      g.fillStyle(c, 1)
      const rx = x + (Math.random() - 0.5) * 30
      const ry = y + (Math.random() - 0.5) * 30
      g.fillCircle(rx, ry, 6)
      this.tweens.add({
        targets: g,
        alpha: 0,
        scale: 2,
        duration: 600 + Math.random() * 400,
        onComplete: () => g.destroy()
      })
    }
  }

  update(time: number, delta: number) {
        // update ping display
        if (this.pingText) {
          this.pingText.setText(`Ping: ${this.lastPing} ms`)
        }
    const dt = delta / 1000
    // update bots
    for (const b of Array.from(this.bots.values())) b.update(dt)

    // update remote players smoothing
    for (const [id, p] of this.players.entries()) {
      if (this.localPlayer && id === this.localPlayer.id) continue
      const g = this.graphicsMap.get(id)
      if (!g) continue
      // lerp draw positions towards target
      // frame-rate independent smoothing: lerp = 1 - exp(-k * dt)
      const k = 8
      const lerp = 1 - Math.exp(-k * dt)
      p.drawX += (p.targetX - p.drawX) * lerp
      p.drawY += (p.targetY - p.drawY) * lerp
      g.clear()
      g.fillStyle(p.color, 1)
      g.fillCircle(p.drawX, p.drawY, 14)
      g.lineStyle(2, 0xffffff, 0.2)
      g.strokeCircle(p.drawX, p.drawY, 14)
    }

    // update scoreboard display
    if (this.scoreboardText) {
      const arr = Array.from(this.players.values()).map((p) => ({ id: p.id, score: p.score || 0 }))
      arr.sort((a, b) => b.score - a.score)
      const lines = arr.slice(0, 6).map((p) => `${p.id.slice(0,6)}: ${p.score}`)
      this.scoreboardText.setText(['Scores:'].concat(lines))
    }

    if (!this.cursors || !this.localPlayer) return

    let dx = 0
    let dy = 0
    if (this.cursors.left?.isDown) dx -= 1
    if (this.cursors.right?.isDown) dx += 1
    if (this.cursors.up?.isDown) dy -= 1
    if (this.cursors.down?.isDown) dy += 1

    // send input & apply locally
    if (dx !== 0 || dy !== 0) {
      const input = this.localPlayer.pushInput(dx, dy)
      if (this.socket) this.socket.emit('input', { dx, dy, seq: input.seq })
    }

    this.localPlayer.update(dt)
  }

  spawnBots(n: number) {
    for (let i = 0; i < n; i++) {
      const id = 'bot-' + Math.random().toString(36).slice(2, 8)
      const b = new Bot(this, id, 100 + Math.random() * 760, 80 + Math.random() * 520)
      this.bots.set(id, b)
    }
  }

  clearBots() {
    for (const b of this.bots.values()) {
      b.gfx.destroy()
    }
    this.bots.clear()
  }
}
