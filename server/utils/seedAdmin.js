/**
 * Seed / promote an admin user.
 *
 * Usage (after configuring .env):
 *   node server/utils/seedAdmin.js admin@example.com "Admin Name" StrongPass123
 *
 * - If the email exists, the user is promoted to admin (and password reset
 *   if one is provided).
 * - If it does not exist, a new admin account is created with the given
 *   name and password.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');

async function run() {
  const [, , email, name, password] = process.argv;

  if (!email) {
    console.error('Usage: node server/utils/seedAdmin.js <email> [name] [password]');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB.');

  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    user.role = 'admin';
    if (password) user.password = password;
    await user.save();
    console.log(`Promoted existing user to admin: ${user.email}`);
  } else {
    if (!password) {
      console.error('A password is required when creating a new admin user.');
      process.exit(1);
    }
    user = new User({
      email: email.toLowerCase(),
      name: name || 'Marsh Admin',
      role: 'admin',
      balance: 0,
    });
    user.password = password;
    await user.save();
    console.log(`Created new admin user: ${user.email}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
