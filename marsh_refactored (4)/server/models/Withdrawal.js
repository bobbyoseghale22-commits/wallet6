const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ['bank', 'crypto'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    // Bank transfer details
    bankName: { type: String, trim: true, default: '' },
    accountName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    routingNumber: { type: String, trim: true, default: '' },

    // Crypto withdrawal details
    cryptoAsset: {
      type: String,
      enum: ['BTC', 'ETH', 'USDT', ''],
      default: '',
    },
    walletAddress: { type: String, trim: true, default: '' },
    network: { type: String, trim: true, default: '' },

    notes: { type: String, trim: true, default: '' },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

withdrawalSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    user: this.user,
    method: this.method,
    amount: this.amount,
    status: this.status,
    bankName: this.bankName,
    accountName: this.accountName,
    accountNumber: this.accountNumber,
    routingNumber: this.routingNumber,
    cryptoAsset: this.cryptoAsset,
    walletAddress: this.walletAddress,
    network: this.network,
    notes: this.notes,
    reviewedAt: this.reviewedAt,
    rejectionReason: this.rejectionReason,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
