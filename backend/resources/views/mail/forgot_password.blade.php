<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f9;padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background-color:#1a56db;padding:36px 40px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">Password Reset Request</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px 40px 32px;">
                            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">Hi there,</p>
                            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
                                We received a request to reset the password for your account. Click the button below to choose a new password. This link will expire in <strong>60 minutes</strong>.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
                                <tr>
                                    <td style="border-radius:6px;background-color:#1a56db;">
                                        <a href="{{ $base_url }}/api/password_reset?remember_token={{ $user->remember_token }}"
                                           style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">
                                            Reset My Password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6b7280;">
                                If the button above doesn't work, copy and paste the link below into your browser:
                            </p>
                            <p style="margin:0 0 32px;font-size:13px;line-height:1.6;word-break:break-all;">
                                <a href="{{ $base_url }}/api/password_reset?remember_token={{ $user->remember_token }}"
                                   style="color:#1a56db;text-decoration:underline;">
                                    {{ $base_url }}/api/password_reset?remember_token={{ $user->remember_token }}
                                </a>
                            </p>

                            <!-- Divider -->
                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;">

                            <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                            <p style="margin:0;font-size:13px;color:#9ca3af;">
                                &copy; {{ date('Y') }} BYU 590R &mdash; This is an automated message, please do not reply.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
