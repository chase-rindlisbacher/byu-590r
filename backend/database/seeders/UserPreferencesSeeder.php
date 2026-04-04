<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Database\Seeder;

class UserPreferencesSeeder extends Seeder
{
    /**
     * One preferences row per user (idempotent).
     */
    public function run(): void
    {
        User::query()->chunkById(100, function ($users) {
            foreach ($users as $user) {
                UserPreference::updateOrCreate(
                    ['user_id' => $user->id],
                    UserPreference::defaultAttributes()
                );
            }
        });
    }
}
