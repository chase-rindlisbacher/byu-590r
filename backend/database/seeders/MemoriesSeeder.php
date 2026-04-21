<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\Media;
use App\Models\Memory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class MemoriesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Requires: UsersSeeder. Locations are created inline or must exist.
     */
    public function run(): void
    {
        $user = User::first(); // or User::find(1)
        if (! $user) {
            return;
        }

        // Optional: seed locations if needed
        $locations = [
            [
                'name' => 'Provo',
                'street' => null,
                'city' => null,
                'state' => 'Utah',
                'zipcode' => null,
            ],
        ];
        foreach ($locations as $loc) {
            Location::firstOrCreate(
                [
                    'name' => $loc['name'],
                    'state' => $loc['state'],
                    'user_id' => $user->id,
                ],
                array_merge($loc, ['user_id' => $user->id])
            );
        }

        $locationId = Location::where('user_id', $user->id)->first()?->id;

        $memories = [
            [
                'journal_entry' => 'Birthday 2026 with my wife! We went bowling and then had Cold Stone Creamery ice cream!',
                'time' => Carbon::parse('2026-03-16'), // when the memory occurred
                'location_id' => $locationId,
                'user_id' => $user->id,
                'media' => [
                    ['url' => 'images/birthday2026.jpeg'],
                ],
            ],
            [
                'journal_entry' => 'Valentines Day 2026 with Janika, Tonya, and Shannon. We went to see Bryan Reegan perform live!',
                'time' => Carbon::parse('2026-02-14'),
                'location_id' => $locationId,
                'user_id' => $user->id,
                'media' => [
                    ['url' => 'images/brianRegan.jpeg'],
                ],
            ],
            [
                'journal_entry' => 'General Conference October 2025 at Uncle Blaine\'s house. We had a great time together!',
                'time' => Carbon::parse('2025-10-4'),
                'location_id' => $locationId,
                'user_id' => $user->id,
                'media' => [
                    ['url' => 'images/generalConf.jpeg'],
                ],
            ],
            [
                'journal_entry' => 'Honeymoon in Cancun Mexico at the Riu Palace Peninsula. We drank so many virgin pinia coladas!',
                'time' => Carbon::parse('2025-08-19'),
                'location_id' => $locationId,
                'user_id' => $user->id,
                'media' => [
                    ['url' => 'images/riuPalacePeninsula.jpeg'],
                ],
            ],
            [
                'journal_entry' => 'Wedding Day 2025 celebrating at the reception with my wife and her old roommates. We got down on the dance floor even though Janika with feeling deathly sick with her heat stroke.',
                'time' => Carbon::parse('2025-08-14'),
                'location_id' => $locationId,
                'user_id' => $user->id,
                'media' => [
                    ['url' => 'images/weddingWithRoomies.jpeg'],
                ],
            ],
        ];

        foreach ($memories as $data) {
            $media = $data['media'] ?? [];
            unset($data['media']);

            $memory = Memory::updateOrCreate(
                [
                    'user_id' => $data['user_id'],
                    'journal_entry' => $data['journal_entry'],
                    'time' => $data['time'],
                ],
                [
                    'location_id' => $data['location_id'],
                ]
            );

            foreach ($media as $m) {
                Media::firstOrCreate(
                    [
                        'memory_id' => $memory->id,
                        'url' => $m['url'],
                    ],
                    ['is_ai_generated' => false]
                );
            }
        }
    }
}
