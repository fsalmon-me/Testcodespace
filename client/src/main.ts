import Phaser from 'phaser'
import ArenaScene from './scenes/ArenaScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  parent: 'game',
  backgroundColor: '#111111',
  scene: [ArenaScene]
}

new Phaser.Game(config)
