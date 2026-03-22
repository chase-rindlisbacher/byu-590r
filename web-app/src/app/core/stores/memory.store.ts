import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Memory } from '../services/memory.service';

export interface MemoryState {
  memoriesList: Memory[];
}

const initialState: MemoryState = {
  memoriesList: [],
};

export const MemoryStore = signalStore(
  { providedIn: 'root' },
  withState<MemoryState>(initialState),
  withMethods((store) => ({
    setMemories(memories: Memory[]): void {
      patchState(store, {
        memoriesList: memories,
      });
    },
    addMemory(memory: Memory): void {
      const currentMemories = store.memoriesList();
      patchState(store, {
        memoriesList: [memory, ...currentMemories],
      });
    },
    setMemory(memory: Memory): void {
      const currentMemories = store.memoriesList();
      const index = currentMemories.findIndex((m) => m.id === memory.id);
      if (index !== -1) {
        const updatedMemories = [...currentMemories];
        updatedMemories[index] = memory;
        patchState(store, {
          memoriesList: updatedMemories,
        });
      }
    },
    removeMemory(memory: Memory): void {
      const currentMemories = store.memoriesList();
      patchState(store, {
        memoriesList: currentMemories.filter((m) => m.id !== memory.id),
      });
    },
  }))
);
