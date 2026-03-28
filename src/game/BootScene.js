import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' })
  }

  create() {
    const initial = this.registry.get('initialSceneKey') || 'HotDog'
    this.scene.start(initial)
  }
}
