import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Memory } from '../services/memory.service';

export interface MemoryState {
  memoriesList: Memory[];
  /** True after first successful list fetch this session (even if the list is empty). */
  listLoadedFromApi: boolean;
}

const initialState: MemoryState = {
  memoriesList: [],
  listLoadedFromApi: false,
};

export const MemoryStore = signalStore(
  { providedIn: 'root' },
  withState<MemoryState>(initialState),
  withMethods((store) => ({
    setMemories(memories: Memory[]): void {
      patchState(store, {
        memoriesList: memories,
        listLoadedFromApi: true,
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

    /** Call on logout or user switch so the next visit does a full load. */
    resetSession(): void {
      patchState(store, {
        memoriesList: [],
        listLoadedFromApi: false,
      });
    },
  }))
);
