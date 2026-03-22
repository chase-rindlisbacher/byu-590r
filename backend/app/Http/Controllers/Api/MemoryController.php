<?php

namespace App\Http\Controllers\Api;

use App\Models\Memory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class MemoryController extends BaseController
{
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
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'journal_entry' => 'required|string',
            'time' => 'required|date',
            'location_id' => 'required|exists:locations,id',
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

        $memory->load(['media', 'location']);

        return $this->sendResponse($memory, 'Memory created successfully');
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
     */
    public function update(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'journal_entry' => 'required|string',
            'time' => 'required|date',
            'location_id' => 'required|exists:locations,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        $user = Auth::user();
        $memory = Memory::findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        $memory->update([
            'journal_entry' => $request->journal_entry,
            'time' => $request->time,
            'location_id' => $request->location_id,
        ]);

        $memory->load(['media', 'location']);

        return $this->sendResponse($memory, 'Memory updated successfully');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $user = Auth::user();
        $memory = Memory::findOrFail($id);

        if ($memory->user_id !== $user->id) {
            return $this->sendError('Unauthorized.', [], 403);
        }

        $memory->delete();

        return $this->sendResponse(['id' => (int) $id], 'Memory deleted');
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
