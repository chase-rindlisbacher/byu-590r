<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your New Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f9;padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background-color:#1a56db;padding:36px 40px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">Your Password Has Been Reset</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px 40px 32px;">
                            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">Hi there,</p>
                            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
                                Your password has been successfully reset. Here is your temporary new password:
                            </p>

                            <!-- Password Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 32px;">
                                <tr>
                                    <td style="background-color:#f0f4ff;border:1px solid #c7d7ff;border-radius:6px;padding:20px;text-align:center;">
                                        <span style="font-size:22px;font-weight:700;color:#1a56db;letter-spacing:2px;font-family:monospace;">{{ $newPassword }}</span>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
                                For your security, we strongly recommend you log in and change this password immediately from your account settings.
                            </p>

                            <!-- Divider -->
                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

                            <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                                If you did not request this change, please contact support immediately as your account may be compromised.
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
