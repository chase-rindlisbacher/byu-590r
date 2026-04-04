<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
    }

    public function test_health_reports_ai_image_generation_availability(): void
    {
        config(['services.gemini.enabled' => true]);
        config(['services.gemini.api_key' => '']);

        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('ai_image_generation_available', false);

        config(['services.gemini.api_key' => 'test-key']);

        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('ai_image_generation_available', true);
    }
}
