const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Configure your SMTP transport here
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.hypetix.si',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'info@hypetix.si',
    pass: process.env.SMTP_PASS || 'Zstavba@1584'
  }
});

/**
 * Send a welcome email to a new user
 * @param {string} toEmail - The user's email address
 * @param {string} userName - The user's name (optional)
 */
async function sendWelcomeEmail(toEmail, userName = '') {
  const templatePath = path.join(process.cwd(), 'src/app/auth/email-templates/welcome-user.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  // Optionally personalize the template
  if (userName) {
    html = html.replace('Dobrodošli v Hypetix!', `Dobrodošli, ${userName}, v Hypetix!`);
  }
  await transporter.sendMail({
    from: 'Hypetix <info@hypetix.si>',
    to: toEmail,
    subject: 'Dobrodošli v Hypetix!',
    html,
    attachments: [
      {
        filename: 'hypetix_logo.png',
        // Absolute path to hypetix/public/images/hypetix_logo.png
        path: path.join(process.cwd(), '../hypetix/public/images/hypetix_logo.png'),
        cid: 'hypetix_logo.png' // same as in the email template src
      }
    ]
  });
}

module.exports = { sendWelcomeEmail };