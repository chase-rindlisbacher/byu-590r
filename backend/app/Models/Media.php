<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Media extends Model
{
    use HasFactory;

    protected $fillable = [
        'url',
        'memory_id',
        'is_ai_generated',
    ];

    protected function casts(): array
    {
        return [
            'is_ai_generated' => 'boolean',
        ];
    }

    public function memory(): BelongsTo
    {
        return $this->belongsTo(Memory::class);
    }
}
