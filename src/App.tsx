import { useState, useEffect, useCallback } from 'react';
import { AdMobService } from './services/admob';
import { useGameEvents } from './hooks/useGameEvents';
// We'll import the Phaser game later
import GameComponent from './components/GameComponent';

type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER';

function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [grazeScore, setGrazeScore] = useState(0);
  const [deathCount, setDeathCount] = useState(0);

  useEffect(() => {
    AdMobService.initialize();
  }, []);

  useEffect(() => {
    if (gameState === 'MENU' || gameState === 'GAME_OVER') {
      AdMobService.showBanner();
    } else {
      AdMobService.hideBanner();
    }
  }, [gameState]);

  // Phaser Events
  useGameEvents('PHASER_GAME_OVER', useCallback(() => {
    setGameState('GAME_OVER');
    setDeathCount((prev) => prev + 1);
  }, []));

  useGameEvents('SCORE_HEIGHT', useCallback((e: CustomEvent) => {
    setScore(e.detail.score);
  }, []));

  useGameEvents('SCORE_GRAZE', useCallback(() => {
    setGrazeScore((prev) => prev + 100);
  }, []));

  useEffect(() => {
    // Show interstitial every 3 deaths
    if (deathCount > 0 && deathCount % 3 === 0 && gameState === 'GAME_OVER') {
      AdMobService.showInterstitial();
    }
  }, [deathCount, gameState]);

  const startGame = useCallback(() => {
    setScore(0);
    setGrazeScore(0);
    setGameState('PLAYING');
    // We can dispatch an event to phaser to start if needed,
    // or the game component unmounting/remounting handles it.
    window.dispatchEvent(new CustomEvent('REACT_START_GAME'));
  }, []);

  const watchAdToContinue = useCallback(() => {
    AdMobService.showRewarded(() => {
      setGameState('PLAYING');
      window.dispatchEvent(new CustomEvent('REACT_CONTINUE_GAME'));
    });
  }, []);

  return (
    <div className="relative w-full h-[100svh] bg-black overflow-hidden font-sans select-none">
      {/* Phaser Game Background */}
      <div className="absolute inset-0 z-0">
         <GameComponent isActive={gameState === 'PLAYING'} />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center">

        {/* Main Menu */}
        {gameState === 'MENU' && (
          <div className="pointer-events-auto flex flex-col items-center justify-center w-full h-full bg-black/60 backdrop-blur-sm">
            <h1 className="text-6xl font-black text-cyan-400 tracking-tighter mb-2 animate-pulse">ORBIT</h1>
            <h1 className="text-6xl font-black text-white tracking-tighter mb-12">GRAZE</h1>

            <button
              onClick={startGame}
              className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-full text-2xl shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all active:scale-95"
            >
              TAP TO START
            </button>
          </div>
        )}

        {/* HUD */}
        {gameState === 'PLAYING' && (
          <div className="w-full flex justify-between p-6 mt-safe">
            <div className="flex flex-col">
              <span className="text-gray-400 text-sm font-bold tracking-widest uppercase">Score</span>
              <span className="text-white text-3xl font-black">{score + grazeScore}</span>
            </div>
          </div>
        )}

        {/* Game Over */}
        {gameState === 'GAME_OVER' && (
          <div className="pointer-events-auto flex flex-col items-center justify-center w-full h-full bg-black/80 backdrop-blur-md">
            <h2 className="text-5xl font-black text-red-500 mb-2">CRASHED</h2>

            <div className="flex flex-col items-center my-8 p-6 bg-white/10 rounded-3xl border border-white/20 w-3/4 max-w-sm">
              <span className="text-gray-400 text-sm uppercase tracking-widest mb-1">Final Score</span>
              <span className="text-white text-6xl font-black">{score + grazeScore}</span>
            </div>

            <div className="flex flex-col gap-4 w-3/4 max-w-sm">
              <button
                onClick={watchAdToContinue}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl text-xl shadow-[0_0_15px_rgba(147,51,234,0.5)] flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <span>▶ WATCH AD TO REVIVE</span>
              </button>

              <button
                onClick={startGame}
                className="w-full py-4 bg-transparent border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 font-bold rounded-2xl text-xl transition-all active:scale-95"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
