const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../config/nodemailer');

const loadTemplate = (templateName, replacements) => {
  const templatePath = path.join(__dirname, '..', 'emails', templateName);
  let html;
  try {
    html = fs.readFileSync(templatePath, 'utf-8');
  } catch {
    html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9"><div style="background:#06080A;padding:24px;border-radius:12px;color:#fff"><h1 style="font-family:Georgia,serif;margin:0 0 16px;color:#C9A86A">Flamingo aur Maina</h1><hr style="border-color:rgba(255,255,255,0.1)">';
    for (const [key, value] of Object.entries(replacements)) {
      html += `<p>${key}: ${value}</p>`;
    }
    html += `<p style="color:rgba(255,255,255,0.5);font-size:13px">Email template "${templateName}" not found. Placeholder content shown.</p></div></div>`;
    return html;
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }

  return html;
};

class EmailService {
  async sendVerificationEmail(user, token) {
    const verificationUrl = `${process.env.FRONTEND_URL}/pages/verify-email.html?token=${token}`;
    const html = loadTemplate('verification.html', {
      name: user.name,
      verificationUrl,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
    });

    await sendEmail({
      to: user.email,
      subject: 'Verify your email - Flamingo aur Maina',
      html,
    });
  }

  async sendWelcomeEmail(user) {
    const html = loadTemplate('welcome.html', {
      name: user.name,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
    });

    await sendEmail({
      to: user.email,
      subject: 'Welcome to Flamingo aur Maina',
      html,
    });
  }

  async sendPasswordResetEmail(user, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/pages/reset-password.html?token=${token}`;
    const html = loadTemplate('forgotPassword.html', {
      name: user.name,
      resetUrl,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
    });

    await sendEmail({
      to: user.email,
      subject: 'Password Reset - Flamingo aur Maina',
      html,
    });
  }

  async sendBookingConfirmation(booking, user, room) {
    const html = loadTemplate('bookingConfirmation.html', {
      name: user.name,
      bookingId: booking._id.toString(),
      roomName: room.name,
      checkIn: new Date(booking.checkIn).toLocaleDateString(),
      checkOut: new Date(booking.checkOut).toLocaleDateString(),
      guests: `${booking.guests.adults} Adults${booking.guests.children ? `, ${booking.guests.children} Children` : ''}`,
      totalAmount: `₹${booking.totalAmount.toLocaleString()}`,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
    });

    await sendEmail({
      to: user.email,
      subject: 'Booking Confirmed - Flamingo aur Maina',
      html,
    });
  }

  async sendContactAutoReply(contact) {
    const html = loadTemplate('contactResponse.html', {
      name: contact.name,
      subject: contact.subject,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
    });

    await sendEmail({
      to: contact.email,
      subject: `Thank you for contacting us - ${contact.subject}`,
      html,
    });
  }

  async sendBookingRequestEmail(booking, user, room) {
    const html = loadTemplate('bookingConfirmation.html', {
      name: user.name,
      bookingId: booking._id.toString(),
      roomName: room.name,
      checkIn: new Date(booking.checkIn).toLocaleDateString(),
      checkOut: new Date(booking.checkOut).toLocaleDateString(),
      guests: `${booking.guests.adults} Adults${booking.guests.children ? `, ${booking.guests.children} Children` : ''}`,
      totalAmount: `₹${booking.totalAmount.toLocaleString()}`,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
      status: 'pending confirmation',
    });

    await sendEmail({
      to: user.email,
      subject: 'Booking Request Received - Flamingo aur Maina',
      html,
    }).catch(() => {});
  }

  async sendBookingCancellationEmail(booking, user, room) {
    const html = loadTemplate('bookingConfirmation.html', {
      name: user.name,
      bookingId: booking._id.toString(),
      roomName: room ? room.name : 'N/A',
      checkIn: new Date(booking.checkIn).toLocaleDateString(),
      checkOut: new Date(booking.checkOut).toLocaleDateString(),
      guests: '',
      totalAmount: `₹${booking.totalAmount.toLocaleString()}`,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
      status: 'cancelled',
    });

    await sendEmail({
      to: user.email,
      subject: 'Booking Cancelled - Flamingo aur Maina',
      html,
    }).catch(() => {});
  }

  async sendBookingModificationEmail(booking, user, room) {
    const html = loadTemplate('bookingConfirmation.html', {
      name: user.name,
      bookingId: booking._id.toString(),
      roomName: room ? room.name : 'N/A',
      checkIn: new Date(booking.checkIn).toLocaleDateString(),
      checkOut: new Date(booking.checkOut).toLocaleDateString(),
      guests: `${booking.guests.adults} Adults${booking.guests.children ? `, ${booking.guests.children} Children` : ''}`,
      totalAmount: `₹${booking.totalAmount.toLocaleString()}`,
      frontendUrl: process.env.FRONTEND_URL,
      year: new Date().getFullYear().toString(),
      status: 'modified',
    });

    await sendEmail({
      to: user.email,
      subject: 'Booking Modified - Flamingo aur Maina',
      html,
    }).catch(() => {});
  }
}

module.exports = new EmailService();
