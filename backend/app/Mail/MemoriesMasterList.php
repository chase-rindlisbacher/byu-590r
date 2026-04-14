<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class MemoriesMasterList extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  Collection<int, \App\Models\Memory>  $memories
     */
    public function __construct(
        public Collection $memories
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Memories master list — '.config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.memories-master-list',
            with: [
                'memories' => $this->memories,
                'generatedAt' => now(),
            ],
        );
    }

    /**
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
