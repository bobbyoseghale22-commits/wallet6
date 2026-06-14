const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default
    },
    profilePicture: {
      type: String,
      default: '',
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    suspended: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

/**
 * Set a plaintext password; it will be hashed before saving.
 * Use: user.password = 'plain'; await user.save();
 */
userSchema.virtual('password').set(function (plain) {
  this._plainPassword = plain;
});

userSchema.pre('save', async function (next) {
  if (!this._plainPassword) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this._plainPassword, salt);
    this._plainPassword = undefined;
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Compare a candidate plaintext password against the stored hash.
 * Note: passwordHash is select:false, so the caller must explicitly
 * select it (e.g. User.findOne(...).select('+passwordHash')).
 */
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

/**
 * Safe public-facing representation (never leaks passwordHash).
 */
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    profilePicture: this.profilePicture,
    balance: this.balance,
    role: this.role,
    suspended: this.suspended,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
