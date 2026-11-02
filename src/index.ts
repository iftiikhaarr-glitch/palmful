import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { EMULATE, installLaptopEmulator } from './laptop-emulator.js';
import { PalmfulSystem } from './palmful-system.js';

async function main() {
  // Laptop mode must install the emulated WebXR runtime before the world
  // looks for navigator.xr.
  if (EMULATE) await installLaptopEmulator();
  const world = await World.create(
    document.getElementById('scene-container') as HTMLDivElement,
    projectOptions,
  );
  world.registerSystem(PalmfulSystem);
}

void main();
