import Phaser from 'phaser'

export class ShapeFactory {
  static randomColor() {
    return Phaser.Display.Color.RandomRGB().color
  }

  static randomStatic(scene: Phaser.Scene, x: number, y: number) {
    const g = scene.add.graphics({ x: 0, y: 0 })
    const color = this.randomColor()
    g.fillStyle(color, 1)
    const r = 18 + Math.floor(Math.random() * 32)
    const shapeType = Math.floor(Math.random() * 3)
    if (shapeType === 0) g.fillCircle(x, y, r)
    else if (shapeType === 1) g.fillRect(x - r, y - r, r * 2, r * 2)
    else {
      // triangle
      g.beginPath()
      g.moveTo(x, y - r)
      g.lineTo(x - r, y + r)
      g.lineTo(x + r, y + r)
      g.closePath()
      g.fillPath()
    }
    g.lineStyle(2, 0x000000, 0.15)
    return g
  }
}
