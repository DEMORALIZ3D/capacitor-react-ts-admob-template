import * as Phaser from 'phaser';

export class SpaceTreat extends Phaser.Physics.Arcade.Sprite {
    public visualRadius: number;
    public effectType: 'GROW' | 'SHRINK';

    constructor(scene: Phaser.Scene, x: number, y: number, radius: number) {
        
        // Pick effect early
        const effectType = Math.random() > 0.5 ? 'GROW' : 'SHRINK';
        const baseColor = effectType === 'GROW' ? 0xff00ff : 0x00ff00;
        
        // Generate texture key dynamically based on radius and type
        const textureKey = `treat_${effectType}_${radius}`;
        if (!scene.textures.exists(textureKey)) {
            const g = scene.make.graphics({ x: 0, y: 0 });
            
            g.lineStyle(2, baseColor, 1);
            g.fillStyle(baseColor, 0.4);

            // Shift drawing to center of generating texture to avoid cutoff
            const cx = radius;
            const cy = radius;

            // Draw a diamond shape
            g.beginPath();
            g.moveTo(cx, cy - radius);
            g.lineTo(cx + radius, cy);
            g.lineTo(cx, cy + radius);
            g.lineTo(cx - radius, cy);
            g.closePath();
            g.fillPath();
            g.strokePath();

            // Inner glowing core
            g.fillStyle(0xffffff, 0.8);
            g.fillCircle(cx, cy, radius * 0.3);

            g.generateTexture(textureKey, radius * 2, radius * 2);
        }

        super(scene, x, y, textureKey);
        
        this.visualRadius = radius;
        this.effectType = effectType;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCircle(radius);
        body.setOffset(0, 0);

        if ('postFX' in this) {
            const fx = (this as any).postFX.addGlow(baseColor, 1.5, 0, false, 0.1, 10);
            
            // Pulse the glow
            scene.tweens.add({
                targets: fx,
                outerStrength: 4,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }

        // Add a gentle rotation tween
        scene.tweens.add({
            targets: this,
            angle: 360,
            duration: Phaser.Math.Between(3000, 5000),
            repeat: -1,
            ease: 'Linear'
        });
    }
}
