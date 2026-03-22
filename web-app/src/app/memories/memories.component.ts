import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemoryService, Memory } from '../core/services/memory.service';
import { MemoryStore } from '../core/stores/memory.store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { isMobile } from '../core/utils/mobile.utils';

@Component({
  selector: 'app-memories',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './memories.component.html',
  styleUrl: './memories.component.scss',
})
export class MemoriesComponent implements OnInit {
  private memoryService = inject(MemoryService);
  private memoryStore = inject(MemoryStore);

  memories = this.memoryStore.memoriesList;
  isLoading = signal(true);

  isMobile = isMobile;

  ngOnInit(): void {
    this.getMemories();
  }

  getMemories(): void {
    this.isLoading.set(true);
    this.memoryService.getMemories().subscribe({
      next: (response) => {
        this.memoryStore.setMemories(response.results);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error fetching memories:', error);
        this.isLoading.set(false);
      },
    });
  }

  formatDate(memory: Memory): string {
    const [datePart] = memory.time.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  locationName(memory: Memory): string {
    return memory.location?.name ?? 'Unknown';
  }
}
