const User = require('../models/User');
const { asyncHandler, ok, fail } = require('../utils/respond');

// Max file size: 5MB as base64
const MAX_B64_LEN = 5 * 1024 * 1024 * 1.37; // base64 overhead ~37%

const VALID_DOC_TYPES = ['proofOfId', 'proofOfAddress', 'proofOfFunds'];
const VALID_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * POST /api/user/kyc/upload
 * Body: { docType, filename, mimeType, data (base64) }
 * Upload one KYC document. Transitions status to 'pending' when all 3 are present.
 */
const uploadDocument = asyncHandler(async (req, res) => {
  const { docType, filename, mimeType, data } = req.body;

  if (!VALID_DOC_TYPES.includes(docType)) {
    return fail(res, 'Invalid document type.', 422);
  }
  if (!filename || !mimeType || !data) {
    return fail(res, 'filename, mimeType, and data are required.', 422);
  }
  if (!VALID_MIME.includes(mimeType)) {
    return fail(res, 'File must be a JPEG, PNG, WEBP, or PDF.', 422);
  }
  if (data.length > MAX_B64_LEN) {
    return fail(res, 'File exceeds the 5 MB limit.', 413);
  }

  const user = req.user;

  // Block re-upload if already approved
  if (user.kyc?.status === 'approved') {
    return fail(res, 'Your KYC is already approved. Contact support to make changes.', 400);
  }

  if (!user.kyc) user.kyc = {};
  user.kyc[docType] = {
    filename: filename.trim(),
    url: `data:${mimeType};base64,${data}`,
    uploadedAt: new Date(),
  };

  // Auto-set status to pending if all three docs now present
  const allUploaded =
    user.kyc.proofOfId?.url &&
    user.kyc.proofOfAddress?.url &&
    user.kyc.proofOfFunds?.url;

  if (allUploaded && ['not_submitted', 'resubmit_requested'].includes(user.kyc.status)) {
    user.kyc.status = 'pending';
    user.kyc.adminNote = '';
  } else if (!user.kyc.status || user.kyc.status === 'not_submitted') {
    // Partial upload — keep status as not_submitted until all 3 done
    user.kyc.status = 'not_submitted';
  }

  user.markModified('kyc');
  await user.save();

  return ok(res, { kyc: user.toPublicJSON().kyc });
});

/**
 * GET /api/user/kyc
 * Return the current user's KYC status (no document data).
 */
const getMyKyc = asyncHandler(async (req, res) => {
  return ok(res, { kyc: req.user.toPublicJSON().kyc });
});

/* ============================================================================
   Admin KYC actions
   ========================================================================== */

/**
 * GET /api/admin/kyc
 * List users with KYC submissions. Query: ?status=pending|approved|rejected|resubmit_requested|not_submitted
 */
const listKyc = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const status = (req.query.status || 'pending').trim();

  const filter = {};
  const validStatuses = ['not_submitted', 'pending', 'approved', 'rejected', 'resubmit_requested'];
  if (validStatuses.includes(status)) {
    filter['kyc.status'] = status;
  } else {
    // Default: show anything submitted
    filter['kyc.status'] = { $in: ['pending', 'approved', 'rejected', 'resubmit_requested'] };
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ 'kyc.proofOfId.uploadedAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-kyc.proofOfId.url -kyc.proofOfAddress.url -kyc.proofOfFunds.url'), // exclude binary data from list
    User.countDocuments(filter),
  ]);

  return ok(res, {
    users: users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      country: u.country,
      phone: u.phone,
      kycStatus: u.kyc?.status || 'not_submitted',
      kycAdminNote: u.kyc?.adminNote || '',
      kycReviewedAt: u.kyc?.reviewedAt || null,
      proofOfId: { filename: u.kyc?.proofOfId?.filename || '', uploadedAt: u.kyc?.proofOfId?.uploadedAt || null },
      proofOfAddress: { filename: u.kyc?.proofOfAddress?.filename || '', uploadedAt: u.kyc?.proofOfAddress?.uploadedAt || null },
      proofOfFunds: { filename: u.kyc?.proofOfFunds?.filename || '', uploadedAt: u.kyc?.proofOfFunds?.uploadedAt || null },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/**
 * GET /api/admin/kyc/:userId/document/:docType
 * Retrieve a single document's base64 data for admin preview.
 */
const getDocument = asyncHandler(async (req, res) => {
  const { userId, docType } = req.params;

  if (!VALID_DOC_TYPES.includes(docType)) {
    return fail(res, 'Invalid document type.', 422);
  }

  const user = await User.findById(userId).select(`kyc.${docType} kyc.status name email`);
  if (!user) return fail(res, 'User not found.', 404);

  const doc = user.kyc?.[docType];
  if (!doc?.url) return fail(res, 'Document not yet uploaded.', 404);

  return ok(res, {
    docType,
    filename: doc.filename,
    url: doc.url,
    uploadedAt: doc.uploadedAt,
    userName: user.name,
    userEmail: user.email,
  });
});

/**
 * PUT /api/admin/kyc/:userId/approve
 * Approve all KYC documents for a user.
 */
const approveKyc = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return fail(res, 'User not found.', 404);

  if (!['pending', 'resubmit_requested'].includes(user.kyc?.status)) {
    return fail(res, 'Only pending or resubmit-requested KYC can be approved.', 400);
  }

  user.kyc.status = 'approved';
  user.kyc.reviewedBy = req.user._id;
  user.kyc.reviewedAt = new Date();
  user.kyc.adminNote = (req.body.note || '').trim();
  user.markModified('kyc');
  await user.save();

  return ok(res, { kycStatus: user.kyc.status, adminNote: user.kyc.adminNote });
});

/**
 * PUT /api/admin/kyc/:userId/reject
 * Reject KYC with a required reason.
 * Body: { note }
 */
const rejectKyc = asyncHandler(async (req, res) => {
  const { note } = req.body;
  if (!note?.trim()) return fail(res, 'A rejection reason is required.', 422);

  const user = await User.findById(req.params.userId);
  if (!user) return fail(res, 'User not found.', 404);

  if (!['pending', 'resubmit_requested'].includes(user.kyc?.status)) {
    return fail(res, 'Only pending or resubmit-requested KYC can be rejected.', 400);
  }

  user.kyc.status = 'rejected';
  user.kyc.reviewedBy = req.user._id;
  user.kyc.reviewedAt = new Date();
  user.kyc.adminNote = note.trim();
  user.markModified('kyc');
  await user.save();

  return ok(res, { kycStatus: user.kyc.status, adminNote: user.kyc.adminNote });
});

/**
 * PUT /api/admin/kyc/:userId/request-resubmit
 * Ask the user to re-upload specific documents.
 * Body: { note }
 */
const requestResubmit = asyncHandler(async (req, res) => {
  const { note } = req.body;
  if (!note?.trim()) return fail(res, 'Please specify what the user needs to resubmit.', 422);

  const user = await User.findById(req.params.userId);
  if (!user) return fail(res, 'User not found.', 404);

  user.kyc.status = 'resubmit_requested';
  user.kyc.reviewedBy = req.user._id;
  user.kyc.reviewedAt = new Date();
  user.kyc.adminNote = note.trim();
  // Clear document slots so user must re-upload
  user.kyc.proofOfId = { filename: '', url: '', uploadedAt: null };
  user.kyc.proofOfAddress = { filename: '', url: '', uploadedAt: null };
  user.kyc.proofOfFunds = { filename: '', url: '', uploadedAt: null };
  user.markModified('kyc');
  await user.save();

  return ok(res, { kycStatus: user.kyc.status, adminNote: user.kyc.adminNote });
});

module.exports = {
  uploadDocument,
  getMyKyc,
  listKyc,
  getDocument,
  approveKyc,
  rejectKyc,
  requestResubmit,
};
