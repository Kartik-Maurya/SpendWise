const nodemailer = require('nodemailer');

let transporter = null;

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!isMailConfigured()) {
    return { sent: false, reason: 'not_configured' };
  }

  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(resetUrl);

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || 'SpendWise <no-reply@spendwise.local>',
    to,
    subject: 'Reset your SpendWise password',
    text: [
      `Hi ${name || 'there'},`,
      '',
      'We received a request to reset your SpendWise password.',
      'Open the link below to choose a new password. It expires in 30 minutes and works once:',
      '',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email; your password stays unchanged.',
    ].join('\n'),
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2933; line-height: 1.5;">
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your SpendWise password.</p>
        <p>
          <a href="${safeUrl}" style="display: inline-block; padding: 10px 18px; border-radius: 8px; background: #4f7cc4; color: #ffffff; text-decoration: none; font-weight: 600;">
            Choose a new password
          </a>
        </p>
        <p>The link expires in 30 minutes and works once.</p>
        <p style="color: #6b7785;">If you did not request this, you can ignore this email; your password stays unchanged.</p>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = { isMailConfigured, sendPasswordResetEmail };
