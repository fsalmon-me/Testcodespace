import Phaser from 'phaser'

export default class Bot {
  scene: Phaser.Scene
  id: string
  x: number
  y: number
  color: number
  gfx: Phaser.GameObjects.Graphics
  tx: number
  ty: number

  constructor(scene: Phaser.Scene, id: string, x = 200, y = 200, color = 0x88ccff) {
    this.scene = scene
    this.id = id
    this.x = x
    this.y = y
    this.color = color
    this.gfx = scene.add.graphics()
    this.tx = x
    this.ty = y
    this.draw()
  }

  draw() {
    this.gfx.clear()
    this.gfx.fillStyle(this.color, 1)
    this.gfx.fillRect(this.x - 12, this.y - 12, 24, 24)
    this.gfx.lineStyle(2, 0x000000, 0.1)
    this.gfx.strokeRect(this.x - 12, this.y - 12, 24, 24)
  }

  update(dt: number) {
    const speed = 120
    const dx = this.tx - this.x
    const dy = this.ty - this.y
    const dist = Math.hypot(dx, dy)
    if (dist < 6) {
      // pick new target
      this.tx = 60 + Math.random() * 840
      this.ty = 60 + Math.random() * 520
    } else {
      this.x += (dx / dist) * speed * dt
      this.y += (dy / dist) * speed * dt
    }
    this.draw()
  }
}
