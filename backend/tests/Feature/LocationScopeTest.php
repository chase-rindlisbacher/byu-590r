<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocationScopeTest extends TestCase
{
    use RefreshDatabase;

    private function authHeader(User $user): array
    {
        $token = $user->createToken('test');

        return ['Authorization' => 'Bearer '.$token->plainTextToken];
    }

    public function test_index_lists_only_current_users_locations(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        Location::create([
            'user_id' => $userA->id,
            'name' => 'Only A',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);
        Location::create([
            'user_id' => $userB->id,
            'name' => 'Only B',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);

        $response = $this->withHeaders($this->authHeader($userA))
            ->getJson('/api/locations');

        $response->assertStatus(200);
        $names = collect($response->json('results'))->pluck('name')->all();
        $this->assertContains('Only A', $names);
        $this->assertNotContains('Only B', $names);
    }

    public function test_store_assigns_authenticated_user_id(): void
    {
        $user = User::factory()->create();

        $response = $this->withHeaders($this->authHeader($user))
            ->postJson('/api/locations', [
                'name' => 'New Place',
                'state' => 'CA',
                'street' => null,
                'city' => null,
                'zipcode' => null,
            ]);

        $response->assertStatus(200);
        $this->assertEquals($user->id, $response->json('results.user_id'));
    }

    public function test_memory_store_rejects_other_users_location_id(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $locationB = Location::create([
            'user_id' => $userB->id,
            'name' => 'Bs Spot',
            'street' => null,
            'city' => null,
            'state' => 'UT',
            'zipcode' => null,
        ]);

        $response = $this->withHeaders($this->authHeader($userA))
            ->postJson('/api/memories', [
                'journal_entry' => 'Journal text here.',
                'time' => now()->toIso8601String(),
                'location_id' => $locationB->id,
            ]);

        $response->assertStatus(422);
    }
}
