// Resend email client.
// Used for password reset emails.
import { Resend } from "resend";

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send password reset emails.");
  }

  // Build and import this module without requiring runtime email credentials.
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
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

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
