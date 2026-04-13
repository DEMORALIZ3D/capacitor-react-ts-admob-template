import * as Phaser from 'phaser';

export class Hazard extends Phaser.Physics.Arcade.Sprite {
    // We will use a polygon graphic to generate a texture
    constructor(scene: Phaser.Scene, x: number, y: number, radius: number) {
        // Create an empty graphics object to draw the hazard
        const g = scene.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0xff0000, 1);

        // Draw a spiky shape
        const points = [];
        const spikes = 6;
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes;
            const r = i % 2 === 0 ? radius : radius * 0.5;
            points.push(new Phaser.Math.Vector2(radius + Math.cos(angle) * r, radius + Math.sin(angle) * r));
        }

        g.fillPoints(points, true);

        // Generate texture key dynamically based on radius
        const textureKey = `hazard_${radius}`;
        if (!scene.textures.exists(textureKey)) {
            g.generateTexture(textureKey, radius * 2, radius * 2);
        }

        super(scene, x, y, textureKey);

        if ('postFX' in this) {
            (this as any).postFX.addGlow(0xff0000, 2.5, 0, false, 0.1, 12);
        }

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setImmovable(true);
        // Make the deadly hitbox exactly 20% smaller than the visual graphics
        body.setCircle(radius * 0.8, radius * 0.2, radius * 0.2);

        // Add a spinning effect
        scene.tweens.add({
            targets: this,
            angle: 360,
            duration: 3000,
            repeat: -1
        });

        // Store visual radius for graze calculations
        this.setData('visualRadius', radius);
    }
}
