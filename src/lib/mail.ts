// Resend email client.
// Used for password reset emails.
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  await resend.emails.send({
    from: process.env.RESEND_FROM ?? "B'Seder <noreply@beseder.app>",
    to: email,
    subject: "Reset your B'Seder password",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#141f3a;margin-bottom:8px">Reset your password</h2>
        <p style="color:#59698a;margin-bottom:24px">
          Click the button below to choose a new password. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#3a6fed;color:#fff;padding:12px 24px;
                  border-radius:12px;text-decoration:none;font-weight:600">
          Reset password
        </a>
        <p style="color:#8090ab;margin-top:24px;font-size:13px">
          If you didn't request this, you can ignore this email.
        </p>
      </div>
    `,
  });
}
