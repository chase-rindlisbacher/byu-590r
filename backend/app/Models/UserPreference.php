<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPreference extends Model
{
    /**
     * Default attribute values (aligned with migration defaults).
     *
     * @return array<string, bool>
     */
    public static function defaultAttributes(): array
    {
        return [
            'generate_images' => true,
            'use_extra_memory_context' => true,
            'dismiss_memory_image_prompt' => false,
        ];
    }

    protected $fillable = [
        'user_id',
        'generate_images',
        'use_extra_memory_context',
        'dismiss_memory_image_prompt',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'generate_images' => 'boolean',
            'use_extra_memory_context' => 'boolean',
            'dismiss_memory_image_prompt' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
