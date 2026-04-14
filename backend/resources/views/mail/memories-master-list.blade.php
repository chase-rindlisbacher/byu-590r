<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Memories master list</title>
</head>
<body style="margin:0;padding:0;font-family:Georgia,'Times New Roman',serif;background-color:#f4f4f5;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                    <tr>
                        <td style="padding:24px 28px;background-color:#002e5d;color:#ffffff;">
                            <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:600;">Memories master list</h1>
                            <p style="margin:0;font-size:14px;opacity:0.9;">{{ config('app.name') }}</p>
                            <p style="margin:12px 0 0 0;font-size:13px;opacity:0.85;">Generated {{ $generatedAt->timezone(config('app.timezone'))->format('l, F j, Y \a\t g:i A T') }}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 28px;">
                            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;">All memories in the system (full snapshot).</p>
                            <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
                                <thead>
                                    <tr>
                                        <th align="left" style="padding:10px 12px;border-bottom:2px solid #e5e7eb;background-color:#f9fafb;">When</th>
                                        <th align="left" style="padding:10px 12px;border-bottom:2px solid #e5e7eb;background-color:#f9fafb;">User</th>
                                        <th align="left" style="padding:10px 12px;border-bottom:2px solid #e5e7eb;background-color:#f9fafb;">Location</th>
                                        <th align="left" style="padding:10px 12px;border-bottom:2px solid #e5e7eb;background-color:#f9fafb;">Journal</th>
                                        <th align="right" style="padding:10px 12px;border-bottom:2px solid #e5e7eb;background-color:#f9fafb;">Media</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($memories as $memory)
                                        <tr>
                                            <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;">{{ $memory->time->timezone(config('app.timezone'))->format('Y-m-d H:i') }}</td>
                                            <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
                                                {{ $memory->user?->name ?? '—' }}<br>
                                                <span style="font-size:12px;color:#6b7280;">{{ $memory->user?->email ?? '' }}</span>
                                            </td>
                                            <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
                                                @if ($memory->location)
                                                    <strong>{{ $memory->location->name }}</strong>
                                                    @if ($memory->location->city || $memory->location->state)
                                                        <br><span style="font-size:12px;color:#6b7280;">{{ trim(implode(', ', array_filter([$memory->location->city, $memory->location->state]))) }}</span>
                                                    @endif
                                                @else
                                                    —
                                                @endif
                                            </td>
                                            <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;max-width:240px;">{{ \Illuminate\Support\Str::limit($memory->journal_entry, 280) }}</td>
                                            <td align="right" style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">{{ $memory->media->count() }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 28px;background-color:#f9fafb;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
                            {{ $memories->count() }} memor{{ $memories->count() === 1 ? 'y' : 'ies' }} total.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
