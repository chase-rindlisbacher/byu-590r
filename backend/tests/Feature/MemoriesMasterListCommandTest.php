<?php

namespace Tests\Feature;

use App\Mail\MemoriesMasterList;
use App\Models\Location;
use App\Models\Memory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MemoriesMasterListCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_sends_memories_master_list_mailable_to_given_email(): void
    {
        Mail::fake();

        $user = User::factory()->create(['name' => 'Report User', 'email' => 'reportuser@example.com']);
        $location = Location::create([
            'name' => 'Campus',
            'street' => '1 Main',
            'city' => 'Provo',
            'state' => 'UT',
            'zipcode' => '84604',
        ]);
        Memory::create([
            'journal_entry' => 'Study group and dinner.',
            'time' => now()->subDay(),
            'location_id' => $location->id,
            'user_id' => $user->id,
        ]);

        $this->artisan('memories:master-list', ['--email' => 'manager@example.com'])
            ->assertExitCode(0);

        Mail::assertSent(MemoriesMasterList::class, function (MemoriesMasterList $mail) {
            return $mail->hasTo('manager@example.com')
                && $mail->memories->count() === 1
                && $mail->memories->first()->journal_entry === 'Study group and dinner.';
        });
    }

    public function test_command_uses_config_default_email_when_option_omitted(): void
    {
        Mail::fake();
        config(['memories.master_list_email' => 'default@example.com']);

        $this->artisan('memories:master-list')
            ->assertExitCode(0);

        Mail::assertSent(MemoriesMasterList::class, fn (MemoriesMasterList $mail) => $mail->hasTo('default@example.com'));
    }
}
