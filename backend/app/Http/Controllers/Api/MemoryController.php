<?php

namespace App\Http\Controllers\Api;

use App\Models\Media;
use App\Models\Memory;
use App\Models\UserPreference;
use App\Services\GeminiMemoryImageService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class MemoryController extends BaseController
{
    public function __construct(
        private readonly GeminiMemoryImageService $geminiMemoryImageService
    ) {}

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
        $broken = $this->rejectBrokenMultipartFiles($request, ['file', 'files']);
        if ($broken) {
            return $broken;
        }

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
                'is_ai_generated' => false,
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
        $broken = $this->rejectBrokenMultipartFiles($request, ['files']);
        if ($broken) {
            return $broken;
        }

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
                        'is_ai_generated' => false,
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
        $broken = $this->rejectBrokenMultipartFiles($request, ['file']);
        if ($broken) {
            return $broken;
        }

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
                $primary->update([
                    'url' => $path,
                    'is_ai_generated' => false,
                ]);
            } else {
                Media::create([
                    'url' => $path,
                    'memory_id' => $memory->id,
                    'is_ai_generated' => false,
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

    /**
     * Generate one AI image from journal text (optional avatar reference) and attach as media.
     */
    public function generateImage(Request $request, string $id)
    {
        if (! config('services.gemini.enabled', true)) {
            return $this->sendError('AI image generation is disabled.', [], 503);
        }

        if (empty(config('services.gemini.api_key'))) {
            return $this->sendError('AI image generation is not configured.', [], 503);
        }

        $validator = Validator::make($request->all(), [
            'use_avatar_reference' => 'sometimes|boolean',
            'use_recent_memory_photos' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        $user = Auth::user();
        $memory = Memory::with(['media', 'location'])->findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        if ($memory->media->isNotEmpty()) {
            return $this->sendError('This memory already has photos. Remove them first if you want a generated image.', [], 409);
        }

        $pref = UserPreference::firstOrCreate(
            ['user_id' => $user->id],
            UserPreference::defaultAttributes()
        );
        if (! $pref->generate_images) {
            return $this->sendError('AI image generation is disabled in your settings.', [], 403);
        }

        $useAvatar = $request->boolean('use_avatar_reference', true);

        $recentMemoryPhotoPaths = [];
        $useRecentPhotos = $request->boolean('use_recent_memory_photos', false) && $pref->use_extra_memory_context;
        if ($useRecentPhotos) {
            $recentMemoryPhotoPaths = Media::query()
                ->whereHas('memory', function ($q) use ($user, $memory) {
                    $q->where('user_id', $user->id)
                        ->where('id', '!=', $memory->id);
                })
                ->orderByDesc('created_at')
                ->limit(2)
                ->pluck('url')
                ->all();
        }

        try {
            $avatarPathForGemini = $useAvatar ? $user->avatar : null;

            $result = $this->geminiMemoryImageService->generateImage(
                $memory->journal_entry,
                $avatarPathForGemini,
                $useAvatar,
                $recentMemoryPhotoPaths
            );
        } catch (\Throwable $e) {
            Log::warning('Gemini memory image failed: '.$e->getMessage(), [
                'memory_id' => $memory->id,
                'exception' => $e,
            ]);

            $message = config('app.debug')
                ? $e->getMessage()
                : 'Could not generate an image. Please try again later.';

            return $this->sendError($message, [], 502);
        }

        $path = $this->storeBinaryMemoryImage($result['bytes'], $result['extension']);
        if (! $path) {
            return $this->sendError('Failed to store generated image.', [], 500);
        }

        Media::create([
            'url' => $path,
            'memory_id' => $memory->id,
            'is_ai_generated' => true,
        ]);

        $memory->load(['media', 'location']);
        $this->resolveMediaUrls(collect([$memory]));

        return $this->sendResponse($memory, 'Image generated and attached');
    }

    /**
     * When PHP rejects an upload (size limits, partial upload, etc.), Laravel's
     * file rules report a generic "failed to upload" message. Detect that first
     * and return a clear error — common on production where upload_max_filesize is 2M.
     */
    private function rejectBrokenMultipartFiles(Request $request, array $keys = ['file', 'files']): ?\Illuminate\Http\JsonResponse
    {
        // Use allFiles(): hasFile() can be false when PHP rejected the upload (invalid
        // UploadedFile), and Laravel's validator then returns the generic "failed to upload".
        $allFiles = $request->allFiles();
        foreach ($keys as $key) {
            if (! array_key_exists($key, $allFiles)) {
                continue;
            }

            $raw = $allFiles[$key];
            $items = $key === 'files' ? (array) $raw : [$raw];

            foreach ($items as $index => $file) {
                if (! $file instanceof UploadedFile) {
                    continue;
                }
                if ($file->isValid()) {
                    continue;
                }

                $attribute = $key === 'files' ? "files.{$index}" : $key;
                $detail = $this->phpUploadErrorMessage($file->getError());

                return $this->sendError($detail, [$attribute => [$detail]], 422);
            }
        }

        return null;
    }

    private function phpUploadErrorMessage(int $errorCode): string
    {
        return match ($errorCode) {
            UPLOAD_ERR_INI_SIZE => 'The file exceeds the server upload limit (PHP upload_max_filesize). Try a smaller image, or increase PHP upload_max_filesize and post_max_size on the server (e.g. 32M).',
            UPLOAD_ERR_FORM_SIZE => 'The file exceeds the maximum POST size (PHP post_max_size).',
            UPLOAD_ERR_PARTIAL => 'The file was only partially uploaded. Please try again.',
            UPLOAD_ERR_NO_FILE => 'No file was received.',
            UPLOAD_ERR_NO_TMP_DIR => 'Server is missing a temporary folder for uploads.',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write the upload to disk on the server.',
            UPLOAD_ERR_EXTENSION => 'A PHP extension blocked the file upload.',
            default => 'The file failed to upload.',
        };
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
                        'is_ai_generated' => false,
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

    private function storeBinaryMemoryImage(string $binary, string $extension): ?string
    {
        try {
            $extension = preg_replace('/[^a-z0-9]/i', '', $extension) ?: 'png';
            $imageName = time().'_'.uniqid('', true).'_memory.'.$extension;
            $path = 'memories/'.$imageName;
            $ok = Storage::disk(self::MEMORY_IMAGE_DISK)->put($path, $binary);
            if (! $ok) {
                Log::error('Memory binary image put failed');

                return null;
            }
            try {
                Storage::disk(self::MEMORY_IMAGE_DISK)->setVisibility($path, 'public');
            } catch (\Throwable $e) {
                Log::warning('S3 setVisibility failed (non-fatal): '.$e->getMessage());
            }

            return $path;
        } catch (\Throwable $e) {
            Log::error('Memory binary image store failed: '.$e->getMessage(), ['exception' => $e]);

            return null;
        }
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
