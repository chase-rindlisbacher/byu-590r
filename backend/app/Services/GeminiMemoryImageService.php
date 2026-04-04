<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Calls Google Gemini image-capable models to produce one image from journal text,
 * optionally with a reference avatar and/or recent memory photos (inline, S3).
 */
class GeminiMemoryImageService
{
    /**
     * @param  list<string>  $additionalReferencePaths  Up to 2 S3 object keys (e.g. other memories’ photos).
     */
    public function generateImage(
        string $journalEntry,
        ?string $avatarStoragePath,
        bool $useAvatarReference,
        array $additionalReferencePaths = []
    ): array {
        $apiKey = config('services.gemini.api_key');
        if (empty($apiKey)) {
            throw new RuntimeException('Gemini API key is not configured.');
        }

        $model = config('services.gemini.model', 'gemini-2.5-flash-image');
        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent',
            $model
        );

        $additionalReferencePaths = array_values(array_slice($additionalReferencePaths, 0, 2));

        // Opt-out matches "no profile photo": do not load or send avatar bytes to Gemini
        if (! $useAvatarReference) {
            $avatarStoragePath = null;
        }

        $hasAvatarInline = false;
        if ($useAvatarReference && $avatarStoragePath) {
            $inline = $this->loadInlineImageFromS3($avatarStoragePath);
            $hasAvatarInline = $inline !== null;
        } else {
            $inline = null;
        }

        $otherMemoryInlines = [];
        foreach ($additionalReferencePaths as $path) {
            if (! is_string($path) || $path === '') {
                continue;
            }
            $loaded = $this->loadInlineImageFromS3($path);
            if ($loaded !== null) {
                $otherMemoryInlines[] = $loaded;
            }
        }

        $prompt = $this->buildPrompt(
            $journalEntry,
            $hasAvatarInline,
            $otherMemoryInlines !== []
        );

        $parts = [
            ['text' => $prompt],
        ];

        if ($hasAvatarInline && $inline !== null) {
            $parts[] = [
                'inline_data' => [
                    'mime_type' => $inline['mime_type'],
                    'data' => $inline['data'],
                ],
            ];
        }

        foreach ($otherMemoryInlines as $ref) {
            $parts[] = [
                'inline_data' => [
                    'mime_type' => $ref['mime_type'],
                    'data' => $ref['data'],
                ],
            ];
        }

        $body = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => $parts,
                ],
            ],
            'generationConfig' => [
                'responseModalities' => ['TEXT', 'IMAGE'],
            ],
        ];

        $timeout = (int) config('services.gemini.timeout', 120);

        try {
            /** @var Response $response */
            $response = Http::withHeaders([
                'x-goog-api-key' => $apiKey,
                'Content-Type' => 'application/json',
            ])
                ->timeout($timeout)
                ->post($url, $body);
        } catch (Throwable $e) {
            Log::error('Gemini HTTP request failed: '.$e->getMessage(), ['exception' => $e]);
            throw new RuntimeException('Could not reach the image service.', 0, $e);
        }

        if (! $response->successful()) {
            $rawBody = $response->body();
            $json = $response->json();
            $apiMsg = is_array($json) && isset($json['error']['message'])
                ? (string) $json['error']['message']
                : 'HTTP '.$response->status();
            Log::warning('Gemini API HTTP error', [
                'status' => $response->status(),
                'body' => $rawBody,
            ]);
            throw new RuntimeException('Gemini: '.$apiMsg);
        }

        $data = $response->json();
        if (! is_array($data)) {
            throw new RuntimeException('Invalid response from image service.');
        }

        if (! empty($data['promptFeedback']['blockReason'])) {
            throw new RuntimeException('Image generation was blocked by safety filters.');
        }

        if (! empty($data['error']['message'])) {
            Log::warning('Gemini error payload', ['error' => $data['error']]);
            throw new RuntimeException('Gemini: '.(string) $data['error']['message']);
        }

        return $this->extractImageFromResponse($data);
    }

    private function buildPrompt(
        string $journalEntry,
        bool $hasProfileReference,
        bool $hasOtherMemoryReferences
    ): string {
        $journalEntry = trim($journalEntry);
        if ($journalEntry === '') {
            throw new RuntimeException('Journal entry is empty.');
        }

        $profileHint = $hasProfileReference
            ? "\nIf a reference photo of a person is included, use it only as a loose likeness guide for anyone who appears in the scene."
            : '';

        $otherMemHint = $hasOtherMemoryReferences
            ? "\nAdditional reference images from the user's other memories may be included; use them only for general mood, palette, and continuity — do not recreate identifiable private scenes or text from those photos."
            : '';

        return <<<PROMPT
Create a single photorealistic image that captures the mood and setting of this personal memory. Do not add text, captions, or watermarks to the image.{$profileHint}{$otherMemHint}

Memory journal entry:
{$journalEntry}
PROMPT;
    }

    /**
     * @return array{mime_type: string, data: string} base64-encoded data
     */
    private function loadInlineImageFromS3(string $pathOnDisk): ?array
    {
        try {
            if (! Storage::disk('s3')->exists($pathOnDisk)) {
                Log::info('S3 path not found for Gemini reference image', ['path' => $pathOnDisk]);

                return null;
            }
            $binary = Storage::disk('s3')->get($pathOnDisk);
            if ($binary === null || $binary === '') {
                return null;
            }
            $ext = strtolower(pathinfo($pathOnDisk, PATHINFO_EXTENSION));
            $mime = match ($ext) {
                'jpg', 'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
                'png' => 'image/png',
                default => 'image/jpeg',
            };

            return [
                'mime_type' => $mime,
                'data' => base64_encode($binary),
            ];
        } catch (Throwable $e) {
            Log::warning('Could not load reference image for Gemini: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @return array{bytes: string, extension: string}
     */
    private function extractImageFromResponse(array $data): array
    {
        $candidates = $data['candidates'] ?? [];
        if ($candidates === []) {
            Log::warning('Gemini returned no candidates', ['keys' => array_keys($data)]);
            throw new RuntimeException('No image candidates returned. Check GEMINI_IMAGE_MODEL and API access.');
        }

        foreach ($candidates as $cand) {
            $finishReason = $cand['finishReason'] ?? $cand['finish_reason'] ?? null;
            if (in_array($finishReason, ['SAFETY', 'RECITATION', 'OTHER'], true)) {
                Log::warning('Gemini candidate blocked or empty', ['finishReason' => $finishReason]);
            }

            $parts = $cand['content']['parts'] ?? [];
            foreach ($parts as $part) {
                $inline = $part['inlineData'] ?? $part['inline_data'] ?? null;
                if (! is_array($inline)) {
                    continue;
                }
                $mime = $inline['mimeType'] ?? $inline['mime_type'] ?? 'image/png';
                $b64 = $inline['data'] ?? '';
                if ($b64 === '') {
                    continue;
                }
                $raw = base64_decode($b64, true);
                if ($raw === false || $raw === '') {
                    continue;
                }

                $extension = match (true) {
                    str_contains($mime, 'jpeg'), str_contains($mime, 'jpg') => 'jpg',
                    str_contains($mime, 'webp') => 'webp',
                    str_contains($mime, 'gif') => 'gif',
                    default => 'png',
                };

                return [
                    'bytes' => $raw,
                    'extension' => $extension,
                ];
            }
        }

        Log::warning('Gemini response had no image parts', [
            'candidate_sample' => json_encode($candidates[0] ?? [], JSON_UNESCAPED_SLASHES),
        ]);

        throw new RuntimeException('No image was returned. Try a different prompt or try again.');
    }
}
