<?php

namespace App\Providers;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->app->booted(function () {
            $schedule = $this->app->make(Schedule::class);
            // Schedule overdue books email - change frequency as needed (currently every minute for testing)
            $schedule->command('auto:overdue-books --email=johnchristiansen@gmail.com')
                ->everyMinute();
            // ->weekly(); // Uncomment for production

            // Weekly memories management report (full snapshot); recipient from config memories.master_list_email
            $schedule->command('memories:master-list')
                ->weeklyOn(1, '8:00')
                ->timezone(config('app.timezone'));
        });
    }
}
