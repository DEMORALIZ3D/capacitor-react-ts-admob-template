import * as Phaser from 'phaser';
import { Hazard } from '../objects/Hazard';

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

  // Game State
  private state: 'ORBITING' | 'FLYING' | 'DEAD' = 'ORBITING';
  private orbitPeg!: Phaser.Math.Vector2;
  private orbitAngle: number = 0;
  private orbitDirection: 1 | -1 = 1;
  private orbitSpeed: number = 0.05;

  private W!: number;
  private H!: number;

  private playerRadius!: number;
  private pegRadius!: number;
  private tetherRadius!: number;
  private hazardBaseRadius!: number;

  private pegsGroup!: Phaser.GameObjects.Group;
  protected hazardsGroup!: Phaser.Physics.Arcade.Group;

  private highestY: number = 0;
  private lastGeneratedY: number = 0;
  private lastPegX: number = 0;

  private laserLine!: Phaser.GameObjects.Line;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('MainScene');
  }

  create() {
    this.W = this.sys.game.canvas.width;
    this.H = this.sys.game.canvas.height;

    this.playerRadius = this.W * 0.03;
    this.pegRadius = this.W * 0.02;
    this.tetherRadius = this.W * 0.20;
    this.hazardBaseRadius = this.W * 0.06;

    this.state = 'ORBITING';
    this.orbitDirection = 1;
    this.highestY = 0;
    this.orbitSpeed = 0.05;

    this.pegsGroup = this.add.group();
    this.hazardsGroup = this.physics.add.group();

    // Generate Initial Level
    const startY = this.H * 0.8;
    this.lastPegX = this.W / 2;
    this.lastGeneratedY = startY;

    this.orbitPeg = new Phaser.Math.Vector2(this.lastPegX, this.lastGeneratedY);
    this.createPeg(this.orbitPeg.x, this.orbitPeg.y);

    // Generate some upcoming pegs ahead of time
    this.generateLevelAhead();

    // Player
    const playerGraph = this.make.graphics({ x: 0, y: 0 });
    playerGraph.fillStyle(0x00ffff, 1);
    playerGraph.fillCircle(this.playerRadius, this.playerRadius, this.playerRadius);
    playerGraph.generateTexture('playerTexture', this.playerRadius * 2, this.playerRadius * 2);

    this.player = this.physics.add.sprite(
      this.orbitPeg.x + this.tetherRadius,
      this.orbitPeg.y,
      'playerTexture'
    ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

    this.player.setCircle(this.playerRadius);
    this.player.setOrigin(0.5, 0.5);

    this.physics.world.setBounds(0, -999999, this.W, 9999999);
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(1, 1);

    // Setup Collision
    this.physics.add.overlap(this.player, this.hazardsGroup, this.onHazardHit, undefined, this);

    this.laserLine = this.add.line(0, 0, 0, 0, 0, 0, 0x00ffff, 0.5);
    this.laserLine.setOrigin(0, 0);

    // Graze Particles
    const pGraph = this.make.graphics({ x:0, y:0 });
    pGraph.fillStyle(0xffff00, 1);
    pGraph.fillRect(0, 0, 4, 4);
    pGraph.generateTexture('grazeParticle', 4, 4);

    this.particles = this.add.particles(0, 0, 'grazeParticle', {
       speed: { min: 50, max: 200 },
       scale: { start: 1, end: 0 },
       lifespan: 300,
       emitting: false
    });

    this.input.on('pointerdown', this.onPointerDown, this);
    this.orbitAngle = 0;
  }

  private generateLevelAhead() {
      // Keep generating upwards until we have enough level relative to camera
      const targetY = this.cameras.main.scrollY - this.H;

      while (this.lastGeneratedY > targetY) {
          this.lastGeneratedY -= this.W * 0.45; // Vertical spacing between pegs

          // Alternate X roughly between 30% and 70% of screen width
          // If last was leftish, go rightish
          let nextX;
          if (this.lastPegX < this.W / 2) {
              nextX = Phaser.Math.Between(this.W * 0.6, this.W * 0.8);
          } else {
              nextX = Phaser.Math.Between(this.W * 0.2, this.W * 0.4);
          }
          this.lastPegX = nextX;

          this.createPeg(nextX, this.lastGeneratedY);

          // Spawn hazard in empty airspace
          // Hazard X should be roughly between the two pegs, or on the opposite side
          const hazardY = this.lastGeneratedY + (this.W * 0.22);
          const hazardX = Phaser.Math.Between(this.W * 0.1, this.W * 0.9);

          const hazard = new Hazard(this, hazardX, hazardY, this.hazardBaseRadius);
          this.hazardsGroup.add(hazard);
      }
  }

  private createPeg(x: number, y: number) {
    const pegGraph = this.add.graphics();
    pegGraph.fillStyle(0xffffff, 1);
    pegGraph.fillCircle(x, y, this.pegRadius);
    pegGraph.lineStyle(2, 0xffffff, 0.2);
    pegGraph.strokeCircle(x, y, this.tetherRadius);

    pegGraph.setData('worldX', x);
    pegGraph.setData('worldY', y);

    this.pegsGroup.add(pegGraph);
  }

  private onPointerDown() {
    if (this.state !== 'ORBITING') return;

    this.state = 'FLYING';
    const tangentAngle = this.orbitAngle + (this.orbitDirection === 1 ? Math.PI / 2 : -Math.PI / 2);
    const flySpeed = this.W * 2.5;

    this.player.setVelocity(
      Math.cos(tangentAngle) * flySpeed,
      Math.sin(tangentAngle) * flySpeed
    );

    this.laserLine.setVisible(false);
  }

  private onHazardHit() {
      if (this.state === 'DEAD') return;
      this.state = 'DEAD';

      this.player.setVelocity(0, 0);
      this.player.setTint(0xff0000);

      this.cameras.main.shake(100, 0.05);

      window.dispatchEvent(new CustomEvent('PHASER_GAME_OVER'));
  }

  update(_time: number, delta: number) {
    if (this.state === 'DEAD') return;

    if (this.state === 'ORBITING') {
      this.updateOrbiting(delta);
    } else if (this.state === 'FLYING') {
      this.updateFlying();
      this.checkGraze();
    }

    this.updateCamera();
    this.updateScore();
    this.cleanupMemory();
    this.generateLevelAhead();
  }

  private updateOrbiting(delta: number) {
    this.player.setVelocity(0, 0);
    this.orbitAngle += this.orbitSpeed * this.orbitDirection * (delta / 16.6);

    const px = this.orbitPeg.x + Math.cos(this.orbitAngle) * this.tetherRadius;
    const py = this.orbitPeg.y + Math.sin(this.orbitAngle) * this.tetherRadius;
    this.player.setPosition(px, py);

    const tangentAngle = this.orbitAngle + (this.orbitDirection === 1 ? Math.PI / 2 : -Math.PI / 2);
    const laserLength = this.W * 0.15;

    this.laserLine.setVisible(true);
    this.laserLine.setTo(
      px, py,
      px + Math.cos(tangentAngle) * laserLength,
      py + Math.sin(tangentAngle) * laserLength
    );
  }

  private updateFlying() {
     const pegs = this.pegsGroup.getChildren() as Phaser.GameObjects.Graphics[];

     for (const peg of pegs) {
        const px = peg.getData('worldX');
        const py = peg.getData('worldY');

        if (px === this.orbitPeg.x && py === this.orbitPeg.y) continue;
        if (py >= this.orbitPeg.y) continue;

        const distSq = Phaser.Math.Distance.BetweenPointsSquared(
           { x: this.player.x, y: this.player.y },
           { x: px, y: py }
        );

        const tetherDistSq = this.tetherRadius * this.tetherRadius;

        if (distSq <= tetherDistSq) {
            this.state = 'ORBITING';
            this.orbitPeg.set(px, py);
            this.player.setVelocity(0, 0);

            const angleToPlayer = Phaser.Math.Angle.Between(px, py, this.player.x, this.player.y);
            this.orbitAngle = angleToPlayer;

            // Determine direction
            const vx = this.player.body.velocity.x;
            const vy = this.player.body.velocity.y;
            const dx = px - this.player.x;
            const dy = py - this.player.y;

            // Cross product to find side
            const crossProduct = (vx * dy) - (vy * dx);
            this.orbitDirection = crossProduct > 0 ? 1 : -1;

            const snapX = px + Math.cos(this.orbitAngle) * this.tetherRadius;
            const snapY = py + Math.sin(this.orbitAngle) * this.tetherRadius;
            this.player.setPosition(snapX, snapY);

            break;
        }
     }
  }

  private checkGraze() {
      // Find hazards close by
      const hazards = this.hazardsGroup.getChildren() as Hazard[];

      for (const h of hazards) {
          // Skip if already grazed
          if (h.getData('grazed')) continue;

          const distSq = Phaser.Math.Distance.BetweenPointsSquared(
             { x: this.player.x, y: this.player.y },
             { x: h.x, y: h.y }
          );

          const visualRadius = h.getData('visualRadius') as number;
          const grazeDistance = visualRadius + this.playerRadius + (this.W * 0.05);

          if (distSq < (grazeDistance * grazeDistance)) {
              // Trigger Graze
              h.setData('grazed', true);
              window.dispatchEvent(new CustomEvent('SCORE_GRAZE'));

              // Particles
              this.particles.emitParticleAt(this.player.x, this.player.y, 10);

              // Micro slow-mo
              this.physics.world.timeScale = 2; // Physics run half speed
              this.time.timeScale = 0.5; // Tweens run half speed
              this.orbitSpeed = 0.025;

              this.time.delayedCall(150, () => {
                  this.physics.world.timeScale = 1;
                  this.time.timeScale = 1;
                  this.orbitSpeed = 0.05;
              });
          }
      }
  }

  private updateCamera() {
    const targetScrollY = this.player.y - (this.H * 0.7);
    if (this.cameras.main.scrollY > targetScrollY) {
       this.cameras.main.scrollY += (targetScrollY - this.cameras.main.scrollY) * 0.1;
    }
  }

  private updateScore() {
     const startY = this.H * 0.8;
     const currentHeight = startY - this.player.y;

     if (currentHeight > this.highestY) {
        this.highestY = currentHeight;
        const score = Math.floor(this.highestY / (this.W * 0.05));

        if (this.registry.get('score') !== score) {
           this.registry.set('score', score);
           window.dispatchEvent(new CustomEvent('SCORE_HEIGHT', { detail: { score }}));
        }
     }
  }

  private cleanupMemory() {
      // Destroy objects that fall way below the camera
      const threshold = this.cameras.main.scrollY + this.H + (this.W * 0.5);

      const pegs = this.pegsGroup.getChildren() as Phaser.GameObjects.Graphics[];
      for (const peg of pegs) {
          if (peg.getData('worldY') > threshold) {
              peg.destroy();
          }
      }

      const hazards = this.hazardsGroup.getChildren() as Hazard[];
      for (const h of hazards) {
          if (h.y > threshold) {
              h.destroy();
          }
      }
  }
}
