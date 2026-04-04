import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { MemoriesComponent } from './memories.component';
import { MemoryService, Memory } from '../core/services/memory.service';
import { LocationService } from '../core/services/location.service';
import { MemoryStore } from '../core/stores/memory.store';

const mockLocations = [
  {
    id: 1,
    name: 'Provo',
    street: null,
    city: null,
    state: 'Utah',
    zipcode: null,
  },
];

const mockMemories: Memory[] = [
  {
    id: 1,
    journal_entry: 'Birthday 2026 with my wife!',
    time: '2026-03-16T00:00:00.000000Z',
    location_id: 1,
    user_id: 1,
    location: {
      id: 1,
      name: 'Provo',
      street: null,
      city: null,
      state: 'Utah',
      zipcode: null,
    },
    media: [{ id: 1, url: 'https://example.com/photo.jpg', memory_id: 1 }],
  },
  {
    id: 2,
    journal_entry: 'Honeymoon in Cancun.',
    time: '2025-08-19T00:00:00.000000Z',
    location_id: 1,
    user_id: 1,
    location: {
      id: 1,
      name: 'Cancun',
      street: null,
      city: null,
      state: 'Mexico',
      zipcode: null,
    },
    media: [],
  },
];

describe('MemoriesComponent', () => {
  let mockMemoryService: jasmine.SpyObj<MemoryService>;
  let mockLocationService: jasmine.SpyObj<LocationService>;

  beforeEach(async () => {
    mockMemoryService = jasmine.createSpyObj('MemoryService', ['getMemories']);
    mockMemoryService.getMemories.and.returnValue(
      of({ success: true, results: mockMemories, message: 'Memories' })
    );

    mockLocationService = jasmine.createSpyObj('LocationService', [
      'listLocations',
    ]);
    mockLocationService.listLocations.and.returnValue(
      of({ success: true, results: mockLocations, message: 'Locations' })
    );

    await TestBed.configureTestingModule({
      imports: [MemoriesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: LocationService, useValue: mockLocationService },
        MemoryStore,
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MemoriesComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should call getMemories on init', () => {
    const fixture = TestBed.createComponent(MemoriesComponent);
    fixture.detectChanges();
    expect(mockMemoryService.getMemories).toHaveBeenCalled();
  });

  it('should load locations on init', () => {
    const fixture = TestBed.createComponent(MemoriesComponent);
    fixture.detectChanges();
    expect(mockLocationService.listLocations).toHaveBeenCalled();
  });

  it('should display memories in the list after getMemories resolves', async () => {
    const fixture = TestBed.createComponent(MemoriesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.memories-list')).toBeTruthy();
    const cards = compiled.querySelectorAll('.memory-card');
    expect(cards.length).toBe(2);

    expect(compiled.textContent).toContain('Birthday 2026 with my wife!');
    expect(compiled.textContent).toContain('Honeymoon in Cancun.');
    expect(compiled.textContent).toContain('Provo');
    expect(compiled.textContent).toContain('Cancun');
    expect(compiled.textContent).toContain('Mar 16, 2026');
    expect(compiled.textContent).toContain('Aug 19, 2025');
  });
});
