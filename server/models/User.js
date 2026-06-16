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
    wallets: {
      btc: { type: Number, default: 0, min: 0 },
      eth: { type: Number, default: 0, min: 0 },
      usdt: { type: Number, default: 0, min: 0 },
    },
    country: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    kyc: {
      status: {
        type: String,
        enum: ['not_submitted', 'pending', 'approved', 'rejected', 'resubmit_requested'],
        default: 'not_submitted',
      },
      proofOfId: {
        filename: { type: String, default: '' },
        url: { type: String, default: '' },
        uploadedAt: { type: Date, default: null },
      },
      proofOfAddress: {
        filename: { type: String, default: '' },
        url: { type: String, default: '' },
        uploadedAt: { type: Date, default: null },
      },
      proofOfFunds: {
        filename: { type: String, default: '' },
        url: { type: String, default: '' },
        uploadedAt: { type: Date, default: null },
      },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      adminNote: { type: String, default: '' },
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

userSchema.pre('save', function (next) {
  if (this.isModified('wallets')) {
    const w = this.wallets || {};
    this.balance = (w.btc || 0) + (w.eth || 0) + (w.usdt || 0);
  }
  next();
});

userSchema.pre('validate', async function (next) {
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
    wallets: {
      btc: this.wallets?.btc || 0,
      eth: this.wallets?.eth || 0,
      usdt: this.wallets?.usdt || 0,
    },
    role: this.role,
    country: this.country || '',
    phone: this.phone || '',
    kyc: {
      status: this.kyc?.status || 'not_submitted',
      proofOfId: this.kyc?.proofOfId || {},
      proofOfAddress: this.kyc?.proofOfAddress || {},
      proofOfFunds: this.kyc?.proofOfFunds || {},
      reviewedAt: this.kyc?.reviewedAt || null,
      adminNote: this.kyc?.adminNote || '',
    },
    suspended: this.suspended,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
