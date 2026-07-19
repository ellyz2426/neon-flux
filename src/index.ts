import { World } from '@iwsdk/core';
import { GameSystem } from './game-system';
import { EnvironmentSystem } from './environment-system';
import { AudioSystem } from './audio-system';

const container = document.getElementById('scene-container') as HTMLDivElement;

const world = await World.create(container, {
  xr: { offer: 'once' },
  features: {
    locomotion: { browserControls: true },
  },
  render: {
    camera: { position: [0, 1.6, 2] },
    fov: 70,
  },
});

world.registerSystem(EnvironmentSystem);
world.registerSystem(AudioSystem);
world.registerSystem(GameSystem);
