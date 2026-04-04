<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPreferencesApiTest extends TestCase
{
    use RefreshDatabase;

    private function authHeader(User $user): array
    {
        $token = $user->createToken('test');

        return ['Authorization' => 'Bearer '.$token->plainTextToken];
    }

    public function test_get_preferences_returns_defaults(): void
    {
        $user = User::factory()->create();

        $response = $this->withHeaders($this->authHeader($user))
            ->getJson('/api/user/preferences');

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('results.generate_images', true);
        $response->assertJsonPath('results.use_extra_memory_context', true);
        $response->assertJsonPath('results.dismiss_memory_image_prompt', false);
        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $user->id,
        ]);
    }

    public function test_patch_preferences_updates_flags(): void
    {
        $user = User::factory()->create();
        UserPreference::where('user_id', $user->id)->delete();

        $response = $this->withHeaders($this->authHeader($user))
            ->patchJson('/api/user/preferences', [
                'generate_images' => false,
                'dismiss_memory_image_prompt' => true,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('results.generate_images', false);
        $response->assertJsonPath('results.dismiss_memory_image_prompt', true);
        $response->assertJsonPath('results.use_extra_memory_context', true);

        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $user->id,
            'generate_images' => 0,
            'dismiss_memory_image_prompt' => 1,
        ]);
    }
}
