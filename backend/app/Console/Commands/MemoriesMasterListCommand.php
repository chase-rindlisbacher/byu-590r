<?php

namespace App\Console\Commands;

use App\Mail\MemoriesMasterList;
use App\Models\Memory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class MemoriesMasterListCommand extends Command
{
    protected $signature = 'memories:master-list
                            {--email= : Recipient address (defaults to config memories.master_list_email)}';

    protected $description = 'Email a full snapshot of all memories to management (MemoriesMasterList mailable).';

    public function handle(): int
    {
        $sendToEmail = $this->option('email') ?: config('memories.master_list_email');
        if (! is_string($sendToEmail) || $sendToEmail === '') {
            $this->error('No recipient: set --email= or MEMORIES_MASTER_LIST_EMAIL / config memories.master_list_email.');

            return Command::FAILURE;
        }

        $memories = Memory::query()
            ->with(['user', 'location', 'media'])
            ->orderBy('time', 'desc')
            ->get();

        try {
            Mail::to($sendToEmail)->send(new MemoriesMasterList($memories));
            $this->info('Memories master list sent successfully to '.$sendToEmail.' ('.$memories->count().' memories).');
        } catch (\Throwable $e) {
            $this->error('Failed to send email: '.$e->getMessage());
            Log::error('Memories master list email failed: '.$e->getMessage(), ['trace' => $e->getTraceAsString()]);

            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
