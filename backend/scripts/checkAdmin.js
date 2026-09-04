const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const admins = await User.find({ role: 'admin' }).select('email name role isVerified').lean();
    const total = await User.countDocuments({});
    console.log('total users:', total);
    if (admins.length) {
      admins.forEach(u => console.log('ADMIN:', u.email, '| name:', u.name || '', '| verified:', u.isVerified));
    } else {
      console.log('NO admin user exists');
    }
    await mongoose.disconnect();
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
})();