import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { MainScene } from '../game/scenes/MainScene';

interface GameComponentProps {
  isActive: boolean;
}

export default function GameComponent({ isActive: _isActive }: GameComponentProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: containerRef.current,
      backgroundColor: '#050510',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: [MainScene],
      scale: {
         mode: Phaser.Scale.RESIZE,
         autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    gameRef.current = new Phaser.Game(config);

    const handleRestart = () => {
        const scene = gameRef.current?.scene.getScene('MainScene') as MainScene;
        if (scene) {
            scene.scene.restart();
        }
    };

    window.addEventListener('REACT_START_GAME', handleRestart);
    window.addEventListener('REACT_CONTINUE_GAME', handleRestart); // Simplistic continue logic

    return () => {
      window.removeEventListener('REACT_START_GAME', handleRestart);
      window.removeEventListener('REACT_CONTINUE_GAME', handleRestart);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
