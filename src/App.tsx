import { useState, useEffect, useCallback } from 'react';
import { AdMobService } from './services/admob';
import { useGameEvents } from './hooks/useGameEvents';
// We'll import the Phaser game later
import GameComponent from './components/GameComponent';

type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER';

function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mockAdMs, setMockAdMs] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [grazeScore, setGrazeScore] = useState(0);
  const [deathCount, setDeathCount] = useState(0);

  const [devSpeed, setDevSpeed] = useState(() => {
    const s = localStorage.getItem('devBaseSpeed');
    return s !== null ? parseFloat(s) : 0.24;
  });
  const [devHazard, setDevHazard] = useState(() => {
     const s = localStorage.getItem('devHazardMult');
     return s !== null ? parseFloat(s) : 1.0;
  });

  const [slowMoEnabled, setSlowMoEnabled] = useState(() => {
    const saved = localStorage.getItem('slowMoSetting');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('slowMoSetting', JSON.stringify(slowMoEnabled));
    window.dispatchEvent(new CustomEvent('TOGGLE_SLOWMO', { detail: { enabled: slowMoEnabled }}));
  }, [slowMoEnabled]);

  useEffect(() => {
     localStorage.setItem('devBaseSpeed', devSpeed.toString());
     localStorage.setItem('devHazardMult', devHazard.toString());
     window.dispatchEvent(new CustomEvent('UPDATE_DEV_SETTINGS', { detail: { baseSpeed: devSpeed, hazardMult: devHazard } }));
  }, [devSpeed, devHazard]);

  useEffect(() => {
      const handler = () => {
          let time = 100;
          setMockAdMs(time);
          const int = setInterval(() => {
              time -= 1;
              setMockAdMs(time);
              if (time <= 0) {
                  clearInterval(int);
                  setMockAdMs(null);
                  if ((window as any).mockAdCallback) {
                     (window as any).mockAdCallback();
                     (window as any).mockAdCallback = null;
                  }
              }
          }, 100);
      };
      window.addEventListener('SHOW_MOCK_AD', handler);
      return () => window.removeEventListener('SHOW_MOCK_AD', handler);
  }, []);

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
        {gameState === 'MENU' && !settingsOpen && (
          <div className="pointer-events-auto flex flex-col items-center justify-center w-full h-full bg-black/60 backdrop-blur-sm">
            <h1 className="text-6xl font-black text-cyan-400 tracking-tighter mb-2 animate-pulse">ORBIT</h1>
            <h1 className="text-6xl font-black text-white tracking-tighter mb-12">GRAZE</h1>

            <button
              onClick={startGame}
              className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-full text-2xl shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all active:scale-95 mb-8"
            >
              TAP TO START
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="px-6 py-2 border border-white/20 hover:bg-white/10 text-gray-300 font-bold rounded-full transition-all"
            >
              ⚙ SETTINGS
            </button>
          </div>
        )}

        {/* Settings Menu */}
        {gameState === 'MENU' && settingsOpen && (
          <div className="pointer-events-auto flex flex-col items-center justify-center w-full h-full bg-black/80 backdrop-blur-md">
            <h2 className="text-4xl font-black text-white mb-8">SETTINGS</h2>
            
            <div className="flex items-center justify-between w-3/4 max-w-sm bg-white/10 p-4 border border-white/20 rounded-2xl mb-4">
               <span className="text-white font-bold text-lg">Action Camera</span>
               <button
                  onClick={() => setSlowMoEnabled(!slowMoEnabled)}
                  className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${slowMoEnabled ? 'bg-cyan-500' : 'bg-gray-600'}`}
               >
                  <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${slowMoEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
               </button>
            </div>

            <div className="flex flex-col w-3/4 max-w-sm bg-white/10 p-4 border border-white/20 rounded-2xl mb-4 text-white">
               <label className="text-sm font-bold uppercase text-gray-300 mb-2">Dev: Start Speed ({devSpeed.toFixed(2)})</label>
               <input type="range" min="0.1" max="1.5" step="0.01" value={devSpeed} onChange={e => setDevSpeed(parseFloat(e.target.value))} className="w-full accent-cyan-500 mb-4" />

               <label className="text-sm font-bold uppercase text-gray-300 mb-2">Dev: Hazard Size ({devHazard.toFixed(2)})</label>
               <input type="range" min="0.1" max="5.0" step="0.1" value={devHazard} onChange={e => setDevHazard(parseFloat(e.target.value))} className="w-full accent-red-500" />
            </div>

            <button
              onClick={() => setSettingsOpen(false)}
              className="px-8 py-4 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-full text-xl transition-all active:scale-95"
            >
              DONE
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

      {mockAdMs !== null && (
         <div className="absolute inset-0 z-50 pointer-events-auto flex items-center justify-center bg-black/95 backdrop-blur-3xl text-white">
             <div className="text-center w-full max-w-sm p-6 border border-white/10 rounded-2xl">
                 <h2 className="text-3xl font-black text-cyan-400 mb-4 animate-pulse">SPONSOR MESSAGE</h2>
                 <p className="text-gray-400 mb-8 font-bold tracking-widest text-sm">Please watch to continue</p>
                 <div className="w-32 h-32 mx-auto rounded-full border-8 border-gray-800 flex items-center justify-center relative">
                     <span className="text-5xl font-black">{Math.ceil(mockAdMs / 10)}</span>
                     <svg className="absolute top-0 left-0 w-full h-full -rotate-90">
                         <circle cx="64" cy="64" r="56" stroke="cyan" strokeWidth="8" fill="none"
                                 strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * (mockAdMs / 100))} />
                     </svg>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
}

export default App;
