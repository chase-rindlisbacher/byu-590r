<?php

namespace App\Http\Controllers\Api;

use App\Models\Media;
use App\Models\Memory;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class MemoryController extends BaseController
{
    /**
     * Primary/cover media: the Media row with the lowest id for this memory.
     * Optional `file` on update replaces that row’s storage object in place.
     */
    private const MEMORY_IMAGE_DISK = 's3';

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $user = Auth::user();
        $memories = Memory::where('user_id', $user->id)
            ->with(['media', 'location'])
            ->orderBy('time', 'desc')
            ->get();

        $this->resolveMediaUrls($memories);

        return $this->sendResponse($memories, 'Memories');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $defaults = [
            'journal_entry' => '',
            'time' => now()->format('Y-m-d\TH:i:s'),
            'location_id' => null,
        ];

        return $this->sendResponse($defaults, 'Create form defaults');
    }

    /**
     * Store a newly created resource in storage.
     * Multipart or JSON: journal_entry, time, location_id; optional file (primary image), files[] (extra images).
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'journal_entry' => 'required|string',
            'time' => 'required|date',
            'location_id' => 'required|exists:locations,id',
            'file' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg,webp',
            'files' => 'nullable|array',
            'files.*' => 'image|mimes:jpeg,png,jpg,gif,svg,webp',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        $user = Auth::user();
        $memory = Memory::create([
            'journal_entry' => $request->journal_entry,
            'time' => $request->time,
            'location_id' => $request->location_id,
            'user_id' => $user->id,
        ]);

        if ($request->hasFile('file')) {
            $path = $this->storeUploadedImage($request->file('file'));
            if (! $path) {
                $memory->delete();

                return $this->sendError('Memory image failed to upload!', [], 500);
            }

            Media::create([
                'url' => $path,
                'memory_id' => $memory->id,
            ]);
        }

        $this->attachAdditionalUploadedFiles($memory, $request->file('files', []));

        $memory->load(['media', 'location']);
        $this->resolveMediaUrls(collect([$memory]));

        return $this->sendResponse($memory, 'Memory created successfully');
    }

    /**
     * Append one or more images to an existing memory.
     */
    public function addMedia(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'files' => 'required|array|min:1',
            'files.*' => 'image|mimes:jpeg,png,jpg,gif,svg,webp',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        $user = Auth::user();
        $memory = Memory::findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        $files = $request->file('files', []);
        if (! is_array($files)) {
            $files = array_filter([$files]);
        }

        foreach ($files as $uploaded) {
            if ($uploaded instanceof UploadedFile && $uploaded->isValid()) {
                $storedPath = $this->storeUploadedImage($uploaded);
                if ($storedPath) {
                    Media::create([
                        'url' => $storedPath,
                        'memory_id' => $memory->id,
                    ]);
                }
            }
        }

        $memory->load(['media', 'location']);
        $this->resolveMediaUrls(collect([$memory]));

        return $this->sendResponse($memory, 'Media added');
    }

    /**
     * Remove one media item from storage and the database.
     */
    public function destroyMedia(string $id)
    {
        $user = Auth::user();
        $media = Media::with('memory')->findOrFail($id);

        if ($media->memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        $memoryId = $media->memory_id;
        $this->deleteStoredFile($media->url);
        $media->delete();

        $memory = Memory::with(['media', 'location'])->findOrFail($memoryId);
        $this->resolveMediaUrls(collect([$memory]));

        return $this->sendResponse($memory, 'Media removed');
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $user = Auth::user();
        $memory = Memory::with(['media', 'location'])->findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        $this->resolveMediaUrls(collect([$memory]));

        return $this->sendResponse($memory, 'Memory');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        $user = Auth::user();
        $memory = Memory::with(['media', 'location'])->findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        $this->resolveMediaUrls(collect([$memory]));

        return $this->sendResponse($memory, 'Edit form data');
    }

    /**
     * Update the specified resource in storage.
     * JSON (PUT/PATCH) or multipart (POST): optional file replaces primary cover; old S3 object removed.
     */
    public function update(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'journal_entry' => 'required|string',
            'time' => 'required|date',
            'location_id' => 'required|exists:locations,id',
            'file' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg,webp',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        $user = Auth::user();
        $memory = Memory::with(['media'])->findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        $memory->update([
            'journal_entry' => $request->journal_entry,
            'time' => $request->time,
            'location_id' => $request->location_id,
        ]);

        if ($request->hasFile('file')) {
            $primary = $this->getPrimaryMedia($memory);
            $oldPath = $primary?->url;

            $path = $this->storeUploadedImage($request->file('file'));
            if (! $path) {
                return $this->sendError('Memory cover failed to upload!', [], 500);
            }

            if ($primary) {
                $this->deleteStoredFile($oldPath);
                $primary->update(['url' => $path]);
            } else {
                Media::create([
                    'url' => $path,
                    'memory_id' => $memory->id,
                ]);
            }
        }

        $memory->load(['media', 'location']);
        $this->resolveMediaUrls(collect([$memory]));

        return $this->sendResponse($memory, 'Memory updated successfully');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $user = Auth::user();
        $memory = Memory::with(['media'])->findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        foreach ($memory->media as $media) {
            $this->deleteStoredFile($media->url);
        }

        $memory->delete();

        return $this->sendResponse(['id' => (int) $id], 'Memory deleted');
    }

    private function attachAdditionalUploadedFiles(Memory $memory, $files): void
    {
        if (! is_array($files)) {
            $files = array_filter([$files]);
        }

        foreach ($files as $uploaded) {
            if ($uploaded instanceof UploadedFile && $uploaded->isValid()) {
                $storedPath = $this->storeUploadedImage($uploaded);
                if ($storedPath) {
                    Media::create([
                        'url' => $storedPath,
                        'memory_id' => $memory->id,
                    ]);
                }
            }
        }
    }

    /**
     * Primary cover: Media with minimum id for this memory.
     */
    private function getPrimaryMedia(Memory $memory): ?Media
    {
        return Media::where('memory_id', $memory->id)->orderBy('id')->first();
    }

    private function storeUploadedImage(UploadedFile $file): ?string
    {
        try {
            $extension = $file->getClientOriginalExtension();
            $imageName = time().'_'.uniqid('', true).'_memory.'.$extension;
            $path = $file->storeAs(
                'memories',
                $imageName,
                self::MEMORY_IMAGE_DISK
            );
            if (! $path) {
                Log::error('Memory image upload failed: storeAs returned empty path');

                return null;
            }
            try {
                Storage::disk(self::MEMORY_IMAGE_DISK)->setVisibility($path, 'public');
            } catch (\Throwable $e) {
                Log::warning('S3 setVisibility failed (non-fatal): '.$e->getMessage());
            }

            return $path;
        } catch (\Throwable $e) {
            Log::error('Memory image upload failed: '.$e->getMessage(), ['exception' => $e]);

            return null;
        }
    }

    /**
     * Permanently remove a file from the configured bucket (same disk as uploads).
     */
    private function deleteStoredFile(?string $path): void
    {
        if (! $path) {
            return;
        }
        try {
            Storage::disk(self::MEMORY_IMAGE_DISK)->delete($path);
        } catch (\Throwable $e) {
            Log::warning('Storage delete failed for path '.$path.': '.$e->getMessage());
        }
    }

    /**
     * Resolve media item URLs to usable S3/public URLs.
     */
    private function resolveMediaUrls($memories): void
    {
        foreach ($memories as $memory) {
            if ($memory->relationLoaded('media') && $memory->media) {
                foreach ($memory->media as $media) {
                    $media->url = $this->getS3Url($media->url) ?? $media->url;
                }
            }
        }
    }
}
