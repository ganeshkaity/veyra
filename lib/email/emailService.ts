import nodemailer from "nodemailer";

export function createEmailTransporter() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user.trim(),
      pass: pass.replace(/\s+/g, ""),
    },
  });
}

export async function sendOtpEmail(to: string, otp: string, purpose: "2fa" | "verification") {
  const transporter = createEmailTransporter();
  if (!transporter) {
    throw new Error("Gmail SMTP is not configured on the server");
  }

  const subject =
    purpose === "2fa"
      ? "Your Veyra Two-Factor Authentication Code"
      : "Verify your email on Veyra";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #2563EB; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Veyra</h1>
        <p style="color: #64748B; font-size: 14px; margin-top: 4px;">Har Baat, Apno Ke Saath.</p>
      </div>
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 16px 0;">Use the verification code below to complete your request:</p>
        <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; margin: 12px 0;">${otp}</div>
        <p style="color: #94a3b8; font-size: 13px; margin: 12px 0 0 0;">Valid for 10 minutes. Do not share this code with anyone.</p>
      </div>
      <p style="color: #64748B; font-size: 13px; text-align: center; margin: 0;">If you did not request this code, you can safely ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Veyra Security" <${process.env.GMAIL_SMTP_USER}>`,
    to,
    subject,
    html,
  });
}
