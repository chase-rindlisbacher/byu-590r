import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  UserPreferenceService,
  UserPreferences,
  UserPreferencesUpdate,
} from '../services/user-preference.service';

export interface UserPreferencesState {
  preferences: UserPreferences | null;
}

const initialState: UserPreferencesState = {
  preferences: null,
};

export const UserPreferencesStore = signalStore(
  { providedIn: 'root' },
  withState<UserPreferencesState>(initialState),
  withComputed(({ preferences }) => ({
    /** When true, show the post-save “Generate an image?” prompt (if no media). */
    shouldOfferAiImagePrompt: computed(() => {
      const p = preferences();
      if (!p) {
        return false;
      }
      if (p.dismiss_memory_image_prompt) {
        return false;
      }
      if (p.generate_images === false) {
        return false;
      }
      return true;
    }),
  })),
  withMethods(
    (
      store,
      prefService = inject(UserPreferenceService)
    ) => ({
      load(): void {
        prefService.getPreferences().subscribe({
          next: (res) => {
            patchState(store, { preferences: res.results });
          },
          error: () => {
            patchState(store, { preferences: null });
          },
        });
      },
      patchFromServer(prefs: UserPreferences): void {
        patchState(store, { preferences: prefs });
      },
      updatePartial(
        body: UserPreferencesUpdate,
        onDone?: (prefs: UserPreferences) => void,
        onError?: () => void
      ): void {
        prefService.updatePreferences(body).subscribe({
          next: (res) => {
            patchState(store, { preferences: res.results });
            onDone?.(res.results);
          },
          error: () => onError?.(),
        });
      },
      clear(): void {
        patchState(store, initialState);
      },
    })
  )
);
