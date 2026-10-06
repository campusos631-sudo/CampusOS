const express = require('express');
const crypto = require('crypto');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Only logged-in students and teachers can upload complaint photos
router.use(authenticate, requireRole('student', 'teacher'));

const BUCKET = 'complaint-images';
const PREFIX = 'data:image/jpeg;base64,';
const MAX_BYTES = 1024 * 1024; // 1 MB after decoding (the browser sends about 200 KB)

// POST /api/uploads/complaint-image: receives a compressed JPEG and stores it in Supabase Storage
router.post('/complaint-image', async (req, res, next) => {
  try {
    const dataUrl = req.body && req.body.image;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PREFIX) || dataUrl.length > 1.5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Please select a valid image' });
    }

    const buffer = Buffer.from(dataUrl.slice(PREFIX.length), 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: 'Image is too large' });
    }
    // Real JPEG files always start with the bytes FF D8
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return res.status(400).json({ error: 'Only JPEG images are allowed' });
    }

    const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!base || !key) {
      console.error('Image upload is not configured: SUPABASE_URL or SUPABASE_SECRET_KEY is missing');
      return res.status(500).json({ error: 'Image upload is not available right now' });
    }

    // Random file name, so nobody can guess another file's address
    const path = `${req.user.id}/${crypto.randomUUID()}.jpg`;

    const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'image/jpeg',
      },
      body: buffer,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Storage upload failed:', response.status, detail);
      return res.status(502).json({ error: 'Could not upload the image. Please try again.' });
    }

    res.status(201).json({ url: `${base}/storage/v1/object/public/${BUCKET}/${path}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
