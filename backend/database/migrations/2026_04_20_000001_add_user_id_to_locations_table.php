<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->after('id')
                ->constrained('users')
                ->cascadeOnDelete();
        });

        // One user per location in memories (enforced outside DB); pick any memory row per location.
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            DB::statement(
                'UPDATE locations SET user_id = (
                    SELECT m.user_id FROM memories AS m WHERE m.location_id = locations.id LIMIT 1
                ) WHERE EXISTS (
                    SELECT 1 FROM memories AS m2 WHERE m2.location_id = locations.id
                )'
            );
        } else {
            DB::statement(
                'UPDATE locations l
                INNER JOIN (
                    SELECT location_id, MIN(user_id) AS user_id FROM memories GROUP BY location_id
                ) m ON m.location_id = l.id
                SET l.user_id = m.user_id'
            );
        }

        $orphanIds = DB::table('locations')->whereNull('user_id')->pluck('id');
        if ($orphanIds->isNotEmpty()) {
            DB::table('locations')->whereIn('id', $orphanIds)->delete();
        }

        Schema::table('locations', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn('user_id');
        });
    }
};
