<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Media;
use App\Models\Memory;
use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MemoryGenerateImageTest extends TestCase
{
    use RefreshDatabase;

    private function authHeader(User $user): array
    {
        $token = $user->createToken('test');

        return ['Authorization' => 'Bearer '.$token->plainTextToken];
    }

    public function test_generate_image_returns_200_and_creates_media_when_gemini_returns_image(): void
    {
        Storage::fake('s3');
        config(['services.gemini.enabled' => true]);
        config(['services.gemini.api_key' => 'test-api-key']);
        config(['services.gemini.model' => 'gemini-2.5-flash-image']);

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', true);

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                [
                                    'inlineData' => [
                                        'mimeType' => 'image/png',
                                        'data' => base64_encode($png),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        $location = Location::create([
            'name' => 'Test City',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);
        $memory = Memory::create([
            'journal_entry' => 'A walk in the park with friends.',
            'time' => now(),
            'location_id' => $location->id,
            'user_id' => $user->id,
        ]);

        $response = $this->withHeaders($this->authHeader($user))
            ->postJson("/api/memories/{$memory->id}/generate-image", [
                'use_avatar_reference' => false,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $memory->refresh();
        $this->assertCount(1, $memory->media);
        $this->assertTrue($memory->media->first()->is_ai_generated);
    }

    public function test_generate_image_with_recent_memory_photos_loads_references_from_s3(): void
    {
        Storage::fake('s3');
        config(['services.gemini.enabled' => true]);
        config(['services.gemini.api_key' => 'test-api-key']);
        config(['services.gemini.model' => 'gemini-2.5-flash-image']);

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', true);
        Storage::disk('s3')->put('memories/ref1.png', $png);

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                [
                                    'inlineData' => [
                                        'mimeType' => 'image/png',
                                        'data' => base64_encode($png),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        $location = Location::create([
            'name' => 'Test City',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);
        $other = Memory::create([
            'journal_entry' => 'Earlier day.',
            'time' => now()->subDay(),
            'location_id' => $location->id,
            'user_id' => $user->id,
        ]);
        Media::create([
            'memory_id' => $other->id,
            'url' => 'memories/ref1.png',
            'is_ai_generated' => false,
        ]);

        $memory = Memory::create([
            'journal_entry' => 'Today’s story.',
            'time' => now(),
            'location_id' => $location->id,
            'user_id' => $user->id,
        ]);

        $response = $this->withHeaders($this->authHeader($user))
            ->postJson("/api/memories/{$memory->id}/generate-image", [
                'use_avatar_reference' => false,
                'use_recent_memory_photos' => true,
            ]);

        $response->assertStatus(200);
        Http::assertSent(function ($request) {
            $body = json_decode($request->body(), true);
            $parts = $body['contents'][0]['parts'] ?? [];

            return count($parts) >= 2
                && isset($parts[1]['inline_data']);
        });
    }

    public function test_generate_image_returns_409_when_memory_already_has_media(): void
    {
        Storage::fake('s3');
        config(['services.gemini.enabled' => true]);
        config(['services.gemini.api_key' => 'test-api-key']);

        $user = User::factory()->create();
        $location = Location::create([
            'name' => 'Test City',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);
        $memory = Memory::create([
            'journal_entry' => 'Already has a photo.',
            'time' => now(),
            'location_id' => $location->id,
            'user_id' => $user->id,
        ]);
        Media::create([
            'memory_id' => $memory->id,
            'url' => 'memories/existing.png',
            'is_ai_generated' => false,
        ]);

        $response = $this->withHeaders($this->authHeader($user))
            ->postJson("/api/memories/{$memory->id}/generate-image", []);

        $response->assertStatus(409);
    }

    public function test_generate_image_returns_403_for_another_users_memory(): void
    {
        config(['services.gemini.enabled' => true]);
        config(['services.gemini.api_key' => 'test-api-key']);

        $owner = User::factory()->create();
        $other = User::factory()->create();
        $location = Location::create([
            'name' => 'Test City',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);
        $memory = Memory::create([
            'journal_entry' => 'Private memory.',
            'time' => now(),
            'location_id' => $location->id,
            'user_id' => $owner->id,
        ]);

        $response = $this->withHeaders($this->authHeader($other))
            ->postJson("/api/memories/{$memory->id}/generate-image", []);

        $response->assertStatus(403);
    }

    public function test_generate_image_returns_503_when_feature_disabled(): void
    {
        config(['services.gemini.enabled' => false]);
        config(['services.gemini.api_key' => 'test-api-key']);

        $user = User::factory()->create();
        $location = Location::create([
            'name' => 'Test City',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);
        $memory = Memory::create([
            'journal_entry' => 'Text only.',
            'time' => now(),
            'location_id' => $location->id,
            'user_id' => $user->id,
        ]);

        $response = $this->withHeaders($this->authHeader($user))
            ->postJson("/api/memories/{$memory->id}/generate-image", []);

        $response->assertStatus(503);
    }

    public function test_generate_image_returns_403_when_user_disabled_ai_in_settings(): void
    {
        config(['services.gemini.enabled' => true]);
        config(['services.gemini.api_key' => 'test-api-key']);

        $user = User::factory()->create();
        UserPreference::where('user_id', $user->id)->update(['generate_images' => false]);

        $location = Location::create([
            'name' => 'Test City',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);
        $memory = Memory::create([
            'journal_entry' => 'Text only.',
            'time' => now(),
            'location_id' => $location->id,
            'user_id' => $user->id,
        ]);

        $response = $this->withHeaders($this->authHeader($user))
            ->postJson("/api/memories/{$memory->id}/generate-image", []);

        $response->assertStatus(403);
    }
}
