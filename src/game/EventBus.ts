import * as Phaser from 'phaser';

// Used to emit events inside Phaser if needed,
// but we mostly use window.dispatchEvent to talk to React.
export const EventBus = new Phaser.Events.EventEmitter();
