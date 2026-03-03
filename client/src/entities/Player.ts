import Phaser from 'phaser'

type Input = { seq: number; dx: number; dy: number }

export default class Player {
  scene: Phaser.Scene
  id: string
  x: number
  y: number
  color: number
  gfx: Phaser.GameObjects.Graphics
  pendingInputs: Input[] = []
  seq = 0
  speedBoostUntil: number = 0

  constructor(scene: Phaser.Scene, id: string, x = 100, y = 100, color = 0xffffff) {
    this.scene = scene
    this.id = id
    this.x = x
    this.y = y
    this.color = color
    this.gfx = scene.add.graphics()
    this.draw()
  }

  draw() {
    this.gfx.clear()
    this.gfx.fillStyle(this.color, 1)
    this.gfx.fillCircle(this.x, this.y, 18)
    this.gfx.lineStyle(2, 0xffffff, 0.15)
    this.gfx.strokeCircle(this.x, this.y, 18)
  }

  applyInput(dx: number, dy: number, dt: number) {
    let speed = 200
    if (Date.now() < this.speedBoostUntil) speed = 400
    this.x += dx * speed * dt
    this.y += dy * speed * dt
    activateSpeedBoost(ms: number) {
      this.speedBoostUntil = Date.now() + ms
      // effet visuel temporaire
      this.scene.tweens.add({
        targets: this.gfx,
        scale: 1.3,
        yoyo: true,
        duration: ms,
        onComplete: () => { this.gfx.setScale(1) }
      })
    }
  }

  // enqueue input and apply locally for client-side prediction
  pushInput(dx: number, dy: number) {
    const input = { seq: ++this.seq, dx, dy, ts: Date.now() }
    this.pendingInputs.push(input)
    // apply immediately with a small dt assumption; real dt used in update
    return input
  }

  // reconcile with server authoritative position and reapply pending inputs
  reconcile(serverX: number, serverY: number, lastAckSeq: number) {
    // Correction only if error is significant
    const dist2 = (this.x - serverX) ** 2 + (this.y - serverY) ** 2
    if (dist2 > 2) {
      // Interpolation douce vers la position serveur
      const oldX = this.x, oldY = this.y
      const newX = serverX, newY = serverY
      this.scene.tweens.add({
        targets: this.gfx,
        x: newX - oldX,
        y: newY - oldY,
        duration: 120,
        onUpdate: () => {
          this.x = oldX + (newX - oldX) * (this.gfx.x / (newX - oldX || 1))
          this.y = oldY + (newY - oldY) * (this.gfx.y / (newY - oldY || 1))
        },
        onComplete: () => {
          this.x = newX
          this.y = newY
          this.gfx.x = 0
          this.gfx.y = 0
        }
      })
    }
    // remove acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter((i) => i.seq > lastAckSeq)
    // replay remaining inputs with a fixed dt approximation
    const dt = 1 / 60
    for (const p of this.pendingInputs) this.applyInput(p.dx, p.dy, dt)
  }

  update(dtSec: number) {
    this.draw()
  }
}
