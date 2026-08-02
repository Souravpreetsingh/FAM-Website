const nodemailer = require('nodemailer');

const PLACEHOLDER_PATTERN = /your-|placeholder|example\.com|_host|_user|_pass|xxxx/i;

const smtpCredentials = {
  host: process.env.SMTP_HOST || '',
  port: process.env.SMTP_PORT || '',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
};

const SMTP_CONFIGURED = !!(
  smtpCredentials.host &&
  smtpCredentials.port &&
  smtpCredentials.user &&
  smtpCredentials.pass &&
  !PLACEHOLDER_PATTERN.test(smtpCredentials.user) &&
  !PLACEHOLDER_PATTERN.test(smtpCredentials.pass) &&
  !PLACEHOLDER_PATTERN.test(smtpCredentials.host)
);

let transporter;
if (SMTP_CONFIGURED) {
  transporter = nodemailer.createTransport({
    host: smtpCredentials.host,
    port: parseInt(smtpCredentials.port, 10),
    secure: parseInt(smtpCredentials.port, 10) === 465,
    auth: {
      user: smtpCredentials.user,
      pass: smtpCredentials.pass,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
}

const sendEmail = async ({ to, subject, html }) => {
  if (!SMTP_CONFIGURED) {
    console.warn(
      `[Nodemailer] SMTP not configured (or placeholder values present). Set real SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in environment. ` +
      `Skipping email to "${to}" with subject "${subject}".`
    );
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error(`[Nodemailer] Failed to send email to "${to}": ${error.message}`);
  }
};

module.exports = { sendEmail };
