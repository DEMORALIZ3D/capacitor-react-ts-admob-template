import * as Phaser from 'phaser';
import { Hazard } from '../objects/Hazard';
import { SpaceTreat } from '../objects/SpaceTreat';

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

  // Game State
  private state: 'ORBITING' | 'FLYING' | 'DASHING' | 'DEAD' = 'ORBITING';
  private dashTargetY: number = 0;
  private orbitPeg!: Phaser.Math.Vector2;
  private orbitAngle: number = 0;
  private orbitDirection: 1 | -1 = 1;
  private orbitSpeed: number = 0.05;
  private orbitCurrentRadius: number = 0;
  private currentTetherRadius!: number;
  private baseOrbitSpeed: number = 0.05;

  private slowMotionEnabled: boolean = true;
  private difficultyMultiplier: number = 1.0;
  private gameTimeMs: number = 0;
  
  private devStartSpeed: number = 0.24;
  private devHazardScale: number = 1.0;

  private directionPointer!: Phaser.GameObjects.Graphics;
  private playerTracker!: Phaser.GameObjects.Graphics;

  private W!: number;
  private H!: number;

  private playerRadius!: number;
  private baseTetherRadius!: number;
  private hazardBaseRadius!: number;

  private pegsGroup!: Phaser.GameObjects.Group;
  protected hazardsGroup!: Phaser.Physics.Arcade.Group;
  protected treatsGroup!: Phaser.Physics.Arcade.Group;

  private highestY: number = 0;
  private lastGeneratedY: number = 0;
  private lastPegX: number = 0;

  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('MainScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0d17');

    this.gameTimeMs = 0;

    const savedSettings = localStorage.getItem('slowMoSetting');
    if (savedSettings !== null) {
        this.slowMotionEnabled = JSON.parse(savedSettings);
    }
    
    const savedSpeed = localStorage.getItem('devBaseSpeed');
    if (savedSpeed !== null) this.devStartSpeed = parseFloat(savedSpeed);

    const savedHazard = localStorage.getItem('devHazardMult');
    if (savedHazard !== null) this.devHazardScale = parseFloat(savedHazard);

    this.difficultyMultiplier = this.devStartSpeed;

    const onToggleSlowMo = (e: any) => { this.slowMotionEnabled = e.detail.enabled; };
    const onDevSet = (e: any) => {
        this.devStartSpeed = e.detail.baseSpeed;
        this.devHazardScale = e.detail.hazardMult;
    };

    window.addEventListener('TOGGLE_SLOWMO', onToggleSlowMo);
    window.addEventListener('UPDATE_DEV_SETTINGS', onDevSet);

    this.events.once('shutdown', () => {
       window.removeEventListener('TOGGLE_SLOWMO', onToggleSlowMo);
       window.removeEventListener('UPDATE_DEV_SETTINGS', onDevSet);
    });

    this.W = this.sys.game.canvas.width;
    this.H = this.sys.game.canvas.height;

    this.playerRadius = this.W * 0.03;
    this.baseTetherRadius = this.W * 0.20;
    this.hazardBaseRadius = this.W * 0.06;

    // Starfield Background
    const starGraph = this.make.graphics({ x: 0, y: 0 });
    starGraph.fillStyle(0xffffff, 0.8);
    starGraph.fillCircle(1.5, 1.5, 1.5);
    starGraph.generateTexture('starParticle', 3, 3);
    
    this.add.particles(0, 0, 'starParticle', {
        x: { min: 0, max: this.W },
        y: { min: -this.H, max: this.H * 3 },
        alpha: { start: 0.1, end: 0.9 },
        scale: { min: 1.5, max: 3.5 },
        lifespan: { min: 2000, max: 5000 },
        frequency: 50,
        blendMode: 'ADD'
    });

    // Player Out-of-bounds Tracker
    this.playerTracker = this.add.graphics({ x: 0, y: 0 });
    this.playerTracker.fillStyle(0xffffff, 0.5);
    this.playerTracker.fillTriangle(-8, -8, -8, 8, 12, 0);
    this.playerTracker.setScrollFactor(0); // Pin to UI layer
    this.playerTracker.setDepth(20);
    this.playerTracker.setVisible(false);

    this.state = 'ORBITING';
    this.orbitDirection = 1;
    this.highestY = 0;
    this.orbitSpeed = 0.05;
    this.baseOrbitSpeed = 0.05;
    this.currentTetherRadius = this.baseTetherRadius;
    this.orbitCurrentRadius = this.currentTetherRadius;

    this.pegsGroup = this.add.group();
    this.hazardsGroup = this.physics.add.group();
    this.treatsGroup = this.physics.add.group();

    // Generate Initial Level
    const startY = this.H * 0.8;
    this.lastPegX = this.W / 2;
    this.lastGeneratedY = startY;

    this.orbitPeg = new Phaser.Math.Vector2(this.lastPegX, this.lastGeneratedY);
    this.createPeg(this.orbitPeg.x, this.orbitPeg.y, this.currentTetherRadius, this.orbitSpeed, 'NORMAL');

    // Generate some upcoming pegs ahead of time
    this.generateLevelAhead();

    // Player
    const playerGraph = this.make.graphics({ x: 0, y: 0 });
    playerGraph.fillStyle(0xffffff, 1);
    playerGraph.fillCircle(this.playerRadius, this.playerRadius, this.playerRadius * 0.6);
    playerGraph.lineStyle(2, 0x00ffff, 0.8);
    playerGraph.strokeCircle(this.playerRadius, this.playerRadius, this.playerRadius * 0.9);
    playerGraph.generateTexture('playerTexture', this.playerRadius * 2, this.playerRadius * 2);

    this.player = this.physics.add.sprite(
      this.orbitPeg.x + this.currentTetherRadius,
      this.orbitPeg.y,
      'playerTexture'
    ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

    this.player.setCircle(this.playerRadius);
    this.player.setOrigin(0.5, 0.5);

    this.physics.world.setBounds(0, -999999, this.W, 9999999);
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(1, 1);

    // Player Trail Particles
    const trailGraph = this.make.graphics({ x: 0, y: 0 });
    trailGraph.fillStyle(0x00ffff, 1);
    trailGraph.fillCircle(2, 2, 2);
    trailGraph.generateTexture('trailParticle', 4, 4);

    const trailEmitter = this.add.particles(0, 0, 'trailParticle', {
        speed: { min: 10, max: 20 },
        scale: { start: 1, end: 0 },
        alpha: { start: 0.6, end: 0 },
        blendMode: 'ADD',
        lifespan: 300
    });
    trailEmitter.startFollow(this.player);

    // Setup Collision
    this.physics.add.overlap(this.player, this.hazardsGroup, this.onHazardHit, undefined, this);
    this.physics.add.overlap(this.player, this.treatsGroup, this.onTreatHit, undefined, this);

    // Direction Indicator Triangle
    this.directionPointer = this.add.graphics({ x: 0, y: 0 });
    this.directionPointer.fillStyle(0x00ffff, 0.8);
    this.directionPointer.beginPath();
    this.directionPointer.moveTo(-6, -6);
    this.directionPointer.lineTo(-6, 6);
    this.directionPointer.lineTo(16, 0);
    this.directionPointer.closePath();
    this.directionPointer.fillPath();

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
          const prevY = this.lastGeneratedY;
          const prevX = this.lastPegX;

          this.lastGeneratedY -= this.W * 0.60; // Extra vertical spacing for way more space

          // Alternate X roughly between 30% and 70% of screen width
          // If last was leftish, go rightish
          let nextX;
          if (this.lastPegX < this.W / 2) {
              nextX = Phaser.Math.Between(this.W * 0.6, this.W * 0.8);
          } else {
              nextX = Phaser.Math.Between(this.W * 0.2, this.W * 0.4);
          }
          this.lastPegX = nextX;

          const radiusMultiplier = Phaser.Math.FloatBetween(0.6, 1.4);
          const radius = this.baseTetherRadius * radiusMultiplier;
          // Apply difficulty multiplier to generated orbits
          const speed = (0.05 / radiusMultiplier) * this.difficultyMultiplier;

          let type: 'NORMAL' | 'YELLOW' | 'BLUE' | 'BLACK_HOLE' = 'NORMAL';
          const r = Math.random();
          if (r < 0.05) type = 'BLACK_HOLE';
          else if (r < 0.15) type = 'YELLOW';
          else if (r < 0.25) type = 'BLUE';

          this.createPeg(nextX, this.lastGeneratedY, radius, speed, type);

          // Hazard size scales with distance
          const distancePassed = Math.abs((this.H * 0.8) - this.lastGeneratedY);
          // Extended distance to make ramp up super slow initially
          const difficultyFactor = Math.min(distancePassed / (40 * this.W), 1.0);
          
          // Exponential ramp: starts tiny (10%) and barely grows at first
          let hazardScale = 0.10 + (Math.pow(difficultyFactor, 2) * 1.40); 
          // Inject dev settings override scale
          hazardScale *= this.devHazardScale;
          // Add minor individual variation
          hazardScale *= Phaser.Math.FloatBetween(0.8, 1.2);
          hazardScale = Math.min(hazardScale, 1.25); // Cap to prevent logic block
          const hRadius = Math.round(this.hazardBaseRadius * hazardScale);

          // Spawn hazard in empty airspace, ensuring it avoids the orbit ring line
          const hazardY = this.lastGeneratedY + (this.W * 0.22);
          let hazardX = Phaser.Math.Between(this.W * 0.1, this.W * 0.9);

          let attempts = 0;
          let safeSpotFound = false;
          while (attempts < 30) {
              const distToNewOrbit = Phaser.Math.Distance.Between(hazardX, hazardY, nextX, this.lastGeneratedY);
              const distToPrevOrbit = Phaser.Math.Distance.Between(hazardX, hazardY, prevX, prevY);
              
              const safeDistNew = radius + hRadius + (this.W * 0.06);
              const safeDistPrev = this.baseTetherRadius * 1.4 + hRadius + (this.W * 0.06);

              if (distToNewOrbit > safeDistNew && distToPrevOrbit > safeDistPrev) {
                  safeSpotFound = true;
                  break; 
              }
              hazardX = Phaser.Math.Between(this.W * 0.1, this.W * 0.9);
              attempts++;
          }

          if (safeSpotFound) {
              const hazard = new Hazard(this, hazardX, hazardY, hRadius);
              this.hazardsGroup.add(hazard);
          }

          // Optional Space Treat (Score > 1000)
          const startY = this.H * 0.8;
          const currentHeightGenerate = startY - this.lastGeneratedY;
          if (currentHeightGenerate > (this.W * 0.05 * 1000) && Math.random() < 0.15) {
               const treatY = hazardY - (this.H * 0.15);
               const tRadius = this.W * 0.035;
               const treatX = Phaser.Math.Between(this.W * 0.1, this.W * 0.9);
               const treat = new SpaceTreat(this, treatX, treatY, tRadius);
               this.treatsGroup.add(treat);
          }
      }
  }

  private createPeg(x: number, y: number, radius: number, speed: number, type: 'NORMAL' | 'YELLOW' | 'BLUE' | 'BLACK_HOLE') {
    const pegGraph = this.add.graphics();
    
    if (type === 'BLACK_HOLE') {
        pegGraph.fillStyle(0x000000, 1);
        pegGraph.fillCircle(x, y, radius * 0.6);
        pegGraph.lineStyle(4, 0x800080, 0.8);
        pegGraph.strokeCircle(x, y, radius * 0.6);
        if ('postFX' in pegGraph) (pegGraph as any).postFX.addGlow(0x800080, 2, 0, false, 0.1, 10);
    } else if (type === 'YELLOW') {
        pegGraph.lineStyle(4, 0xffff00, 0.5);
        pegGraph.strokeCircle(x, y, radius);
        if ('postFX' in pegGraph) (pegGraph as any).postFX.addGlow(0xffff00, 1.5, 0, false, 0.1, 10);
    } else if (type === 'BLUE') {
        pegGraph.lineStyle(4, 0x0088ff, 0.5);
        pegGraph.strokeCircle(x, y, radius);
        if ('postFX' in pegGraph) (pegGraph as any).postFX.addGlow(0x0088ff, 1.5, 0, false, 0.1, 10);
    } else {
        // Faint neon orbit tether, no central anchor
        pegGraph.lineStyle(2, 0x00ffff, 0.08);
        pegGraph.strokeCircle(x, y, radius);
    }

    pegGraph.setData('worldX', x);
    pegGraph.setData('worldY', y);
    pegGraph.setData('radius', radius);
    pegGraph.setData('speed', speed);
    pegGraph.setData('type', type);

    this.pegsGroup.add(pegGraph);
  }

  private onPointerDown() {
    if (this.state !== 'ORBITING') return;

    this.state = 'FLYING';
    const tangentAngle = this.orbitAngle + (this.orbitDirection === 1 ? Math.PI / 2 : -Math.PI / 2);
    // Apply difficulty multiplier to flight
    const flySpeed = this.W * 2.5 * this.difficultyMultiplier;

    this.player.setVelocity(
      Math.cos(tangentAngle) * flySpeed,
      Math.sin(tangentAngle) * flySpeed
    );

    this.directionPointer.setVisible(false);
  }

  private onHazardHit() {
      if (this.state === 'DEAD' || this.state === 'DASHING') return;
      this.state = 'DEAD';

      this.player.setVelocity(0, 0);
      this.player.setTint(0xff0000);

      this.cameras.main.shake(100, 0.05);

      window.dispatchEvent(new CustomEvent('PHASER_GAME_OVER'));
  }

  private onTreatHit(_player: any, treat: any) {
      if (this.state === 'DEAD' || this.state === 'DASHING') return;

      const t = treat as SpaceTreat;
      const effect = t.effectType;
      t.destroy();
      
      this.tweens.add({
          targets: this.player,
          scale: effect === 'GROW' ? 2.5 : 0.5,
          duration: 300,
          yoyo: true,
          hold: 10000,
      });

      // Visual feedback
      this.cameras.main.flash(200, effect === 'GROW' ? 255 : 0, effect === 'GROW' ? 0 : 255, 0);
  }

  update(_time: number, delta: number) {
    if (this.state === 'DEAD') return;

    // Difficulty ramp logic
    this.gameTimeMs += delta;
    // Ramp dynamically based on the user's dev starting speed
    this.difficultyMultiplier = this.devStartSpeed + (this.gameTimeMs / 60000) * 0.4; 
    if (this.difficultyMultiplier > 2.5) this.difficultyMultiplier = 2.5;

    // Tracker UI Update
    this.updateTracker();

    // Check if player fell off the bottom of the screen
    if (this.player.y > this.cameras.main.scrollY + this.H + (this.W * 0.1)) {
        this.onHazardHit(); // Reuse the death sequence
        return;
    }

    if (this.state === 'ORBITING') {
      this.updateOrbiting(delta);
    } else if (this.state === 'FLYING') {
      this.updateFlying();
      this.checkGraze();
    } else if (this.state === 'DASHING') {
      // Create a massive trail effect while dashing
      this.particles.emitParticleAt(this.player.x, this.player.y + this.playerRadius*2, 2);
      
      if (this.player.y <= this.dashTargetY) {
          this.state = 'FLYING';
          this.player.setScale(1); // Restore from scale 0
          this.player.setVelocity(0, -(this.W * 2.5 * this.difficultyMultiplier));
      }
    }

    this.updateCamera();
    this.updateScore();
    this.cleanupMemory();
    this.generateLevelAhead();
  }

  private updateOrbiting(delta: number) {
    this.player.setVelocity(0, 0);
    this.orbitAngle += this.orbitSpeed * this.orbitDirection * (delta / 16.6);

    const px = this.orbitPeg.x + Math.cos(this.orbitAngle) * this.orbitCurrentRadius;
    const py = this.orbitPeg.y + Math.sin(this.orbitAngle) * this.orbitCurrentRadius;
    this.player.setPosition(px, py);

    const tangentAngle = this.orbitAngle + (this.orbitDirection === 1 ? Math.PI / 2 : -Math.PI / 2);
    // Draw the indicator slightly offset from player body radially outside
    const pointerDist = this.playerRadius * 1.5;
    this.directionPointer.setVisible(true);
    this.directionPointer.setPosition(px + Math.cos(tangentAngle) * pointerDist, py + Math.sin(tangentAngle) * pointerDist);
    this.directionPointer.setRotation(tangentAngle);
  }

  private updateFlying() {
     const pegs = this.pegsGroup.getChildren() as Phaser.GameObjects.Graphics[];

     for (const peg of pegs) {
        const px = peg.getData('worldX');
        const py = peg.getData('worldY');

        if (px === this.orbitPeg.x && py === this.orbitPeg.y) continue;
        if (py >= this.orbitPeg.y) continue;

        const dx = px - this.player.x;
        const dy = py - this.player.y;
        const distSq = dx*dx + dy*dy;
        const dist = Math.sqrt(distSq);

        const radius = peg.getData('radius');
        const speed = peg.getData('speed');
        const tetherDistSq = radius * radius;

        // Gentle "Planets pull" freeflight gravity (reduced drastically to prevent orbit edge snapping)
        if (dist > 0 && dist < this.W * 1.5) {
            const pullForce = (200 * radius) / Math.max(distSq, 1);
            this.player.body.velocity.x += (dx / dist) * pullForce;
            this.player.body.velocity.y += (dy / dist) * pullForce;
        }

        if (distSq <= tetherDistSq) {
            const pegType = peg.getData('type');

            if (pegType === 'BLACK_HOLE') {
                this.state = 'DASHING';
                this.player.setVelocity(0, 0);
                this.player.setPosition(px, py);
                this.orbitPeg.set(px, py);
                
                // Visual shrink
                this.tweens.add({
                    targets: this.player,
                    scale: 0,
                    duration: 300,
                    onComplete: () => {
                        // Pareto jump distance heavily weighted to shorter burst (10 to 1000 equivalent)
                        const rand = Math.pow(Math.random(), 2); 
                        const jumpDist = 10 + (rand * 990);
                        this.dashTargetY = this.player.y - (jumpDist * this.H * 0.05); 
                        
                        this.player.body.velocity.y = - (this.H * 6); // Blast upwards massively
                        this.player.body.velocity.x = 0;
                        this.particles.emitParticleAt(this.player.x, this.player.y, 50);
                    }
                });
                break;
            }

            this.state = 'ORBITING';
            this.orbitPeg.set(px, py);
            this.currentTetherRadius = radius;
            
            let finalSpeed = speed;
            if (pegType === 'YELLOW') finalSpeed *= 2.0;
            if (pegType === 'BLUE') finalSpeed *= 0.5;

            this.baseOrbitSpeed = finalSpeed;
            this.orbitSpeed = finalSpeed;
            this.player.setVelocity(0, 0);

            const angleToPlayer = Phaser.Math.Angle.Between(px, py, this.player.x, this.player.y);
            this.orbitAngle = angleToPlayer;

            // Determine direction
            const vx = this.player.body.velocity.x;
            const vy = this.player.body.velocity.y;

            const currentScore = this.registry.get('score') || 0;
            if (currentScore > 500) {
                 const vMag = Math.sqrt(vx*vx + vy*vy);
                 if (vMag > 0 && dist > 0) {
                     const dot = ((vx/vMag) * (-dx/dist)) + ((vy/vMag) * (-dy/dist));
                     const align = Math.abs(dot); // 1 = direct hit, 0 = tangent
                     if (align < 0.2) {
                          this.orbitSpeed *= 1.5; // Boost grazing!
                     } else if (align > 0.8) {
                          this.orbitSpeed *= 0.4; // Friction damping headon!
                     }
                     this.baseOrbitSpeed = this.orbitSpeed;
                 }
            }

            // Cross product to find side confirms angular momentum direction
            const crossProduct = (vx * dy) - (vy * dx);
            this.orbitDirection = crossProduct > 0 ? 1 : -1;

            // Orbit entry bloom burst
            this.particles.emitParticleAt(this.player.x, this.player.y, 25);

            // Smooth Synth Wave in and out (no ball distortion)
            this.tweens.addCounter({
                from: 0,
                to: Math.PI,
                duration: 800,
                ease: 'Sine.easeInOut',
                onUpdate: (tween: any) => {
                    // Mathematically overlay a pure sine wave on top of the distance interpolation
                    const val = tween.getValue() || 0;
                    const weight = tween.progress || 0;
                    const wave = Math.sin(val);
                    this.orbitCurrentRadius = Phaser.Math.Linear(dist, this.currentTetherRadius, weight) + (wave * this.W * 0.05);
                },
                onComplete: () => {
                    this.orbitCurrentRadius = this.currentTetherRadius;
                }
            });

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
          // Trigger sooner by creating a far wider "graze" hitbox
          const grazeDistance = visualRadius + this.playerRadius + (this.W * 0.12);

          if (distSq < (grazeDistance * grazeDistance)) {
              // Trigger Graze
              h.setData('grazed', true);
              window.dispatchEvent(new CustomEvent('SCORE_GRAZE'));

              // Particles
              this.particles.emitParticleAt(this.player.x, this.player.y, 10);

              if (this.slowMotionEnabled) {
                  // Extended Cinematic slow-mo
                  this.physics.world.timeScale = 2; // Physics run half speed
                  this.time.timeScale = 0.5; // Tweens run half speed
                  this.orbitSpeed = this.baseOrbitSpeed * 0.5;

                  this.tweens.add({
                      targets: this.cameras.main,
                      zoom: 1.3,
                      duration: 150,
                      ease: 'Sine.easeOut'
                  });

                  // Stay slow-mo longer, snap zoom out quicker
                  this.time.delayedCall(800, () => {
                      this.physics.world.timeScale = 1;
                      this.time.timeScale = 1;
                      this.orbitSpeed = this.baseOrbitSpeed;

                      this.tweens.add({
                          targets: this.cameras.main,
                          zoom: 1.0,
                          duration: 100,
                          ease: 'Sine.easeIn'
                      });
                  });
              } else {
                  // Standard quick graze without zoom/slowmo
                  this.orbitSpeed = this.baseOrbitSpeed * 0.8;
                  this.time.delayedCall(100, () => {
                      this.orbitSpeed = this.baseOrbitSpeed;
                  });
              }
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

  private updateTracker() {
      const cw = this.cameras.main.width;
      const ch = this.cameras.main.height;
      const view = this.cameras.main.worldView;
      const margin = 20;

      if (!view.contains(this.player.x, this.player.y)) {
          this.playerTracker.setVisible(true);

          let screenX = this.player.x - view.left;
          let screenY = this.player.y - view.top;

          screenX = Phaser.Math.Clamp(screenX, margin, cw - margin);
          screenY = Phaser.Math.Clamp(screenY, margin, ch - margin);

          this.playerTracker.setPosition(screenX, screenY);

          // Point arrow directly at player's offscreen position
          const angle = Phaser.Math.Angle.Between(screenX, screenY, this.player.x - view.left, this.player.y - view.top);
          this.playerTracker.setRotation(angle);
      } else {
          this.playerTracker.setVisible(false);
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
