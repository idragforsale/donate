require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const Fastify        = require('fastify');
const cors           = require('@fastify/cors');
const multipart      = require('@fastify/multipart');
const staticFiles    = require('@fastify/static');
const { Server: IOServer } = require('socket.io');
const db = require('./db');

const fastify = Fastify({ logger: true });

// ===== Uploads directory =====
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ===== In-memory queue (rebuilt from DB on startup) =====
const queues      = new Map(); // venueId -> [item, ...]
const nowPlaying  = new Map(); // venueId -> item | null
const settings    = new Map(); // venueId -> { autoApprove: bool }

function getQueue(venueId) {
  if (!queues.has(venueId)) queues.set(venueId, []);
  return queues.get(venueId);
}

// ===== Plugins (register before listen) =====
fastify.register(cors, { origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] });
fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
fastify.register(staticFiles, { root: UPLOADS_DIR, prefix: '/uploads/' });

// ===== Socket.IO (init after listen) =====
let io;

function emitState(venueId) {
  if (!io) return;
  const now  = nowPlaying.get(venueId) || null;
  const next = getQueue(venueId).slice(0, 6);
  io.to(`venue_${venueId}_display`).emit('nowPlaying', { now, next });
}

async function finishPlaying(venueId, qiId, donationId) {
  await db.query(`UPDATE queue_items SET status='DONE', ended_at=NOW() WHERE id=?`, [qiId]);
  await db.query(`UPDATE donations SET status='DONE' WHERE id=?`, [donationId]);
  nowPlaying.set(venueId, null);
  await startNextIfIdle(venueId);
}

async function startNextIfIdle(venueId) {
  if (nowPlaying.get(venueId)) return;
  const q    = getQueue(venueId);
  const item = q.shift();
  if (!item) { emitState(venueId); return; }

  nowPlaying.set(venueId, item);
  await db.query(`UPDATE queue_items SET status='PLAYING', started_at=NOW() WHERE id=?`, [item.qi_id]);
  await db.query(`UPDATE donations SET status='PLAYING' WHERE id=?`, [item.id]);
  emitState(venueId);

  setTimeout(() => finishPlaying(venueId, item.qi_id, item.id), item.duration_sec * 1000);
}

// ===== DB Init: rebuild queue from DB =====
async function initVenue(venueId) {
  // Load WAITING queue items
  const [rows] = await db.query(`
    SELECT d.*, qi.id AS qi_id, qi.created_at AS qi_at
    FROM queue_items qi
    JOIN donations d ON qi.donation_id = d.id
    WHERE qi.venue_id = ? AND qi.status = 'WAITING'
    ORDER BY qi.created_at ASC
  `, [venueId]);
  queues.set(venueId, rows);

  // Resume PLAYING item if any
  const [playing] = await db.query(`
    SELECT d.*, qi.id AS qi_id, qi.started_at
    FROM queue_items qi
    JOIN donations d ON qi.donation_id = d.id
    WHERE qi.venue_id = ? AND qi.status = 'PLAYING'
    LIMIT 1
  `, [venueId]);

  if (playing.length > 0) {
    const item    = playing[0];
    const elapsed = (Date.now() - new Date(item.started_at).getTime()) / 1000;
    const remain  = item.duration_sec - elapsed;
    nowPlaying.set(venueId, item);
    if (remain > 0) {
      setTimeout(() => finishPlaying(venueId, item.qi_id, item.id), remain * 1000);
    } else {
      await finishPlaying(venueId, item.qi_id, item.id);
    }
  } else {
    nowPlaying.set(venueId, null);
  }
}

// ===== API Routes =====

fastify.get('/health', async () => ({ ok: true }));

// --- Settings helpers ---
function getSettings(venueId) {
  if (!settings.has(venueId)) settings.set(venueId, { autoApprove: false });
  return settings.get(venueId);
}

// GET settings
fastify.get('/admin/settings', async (req) => {
  const venueId = Number(req.query.venue_id || 1);
  return { settings: getSettings(venueId) };
});

// PUT settings
fastify.put('/admin/settings', async (req) => {
  const body    = req.body || {};
  const venueId = Number(body.venue_id || 1);
  const current = getSettings(venueId);
  if (typeof body.autoApprove === 'boolean') current.autoApprove = body.autoApprove;
  return { ok: true, settings: current };
});

// --- Packages ---
fastify.get('/packages', async (req) => {
  const venueId = Number(req.query.venue_id || 1);
  const [rows] = await db.query(
    `SELECT * FROM packages WHERE venue_id = ? AND is_active = 1 ORDER BY tier`,
    [venueId]
  );
  return { packages: rows };
});

// --- Create donation ---
fastify.post('/donations', async (req, reply) => {
  const body      = req.body || {};
  const venueId   = Number(body.venue_id || 1);
  const packageId = Number(body.package_id);

  if (!packageId) return reply.status(400).send({ ok: false, error: 'package_id required' });

  const [[pkg]] = await db.query(
    `SELECT * FROM packages WHERE id = ? AND venue_id = ? AND is_active = 1`,
    [packageId, venueId]
  );
  if (!pkg) return reply.status(400).send({ ok: false, error: 'package not found' });

  const imageUrl = body.image_url || '';
  const [result] = await db.query(
    `INSERT INTO donations
      (venue_id, package_id, display_name, message, ig, fb, tiktok, image_url, amount, duration_sec, tier, effect, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      venueId, packageId,
      body.display_name || 'Anonymous',
      (body.message || '').slice(0, 60),
      body.ig || '', body.fb || '', body.tiktok || '',
      imageUrl,
      pkg.price, pkg.duration_sec, pkg.tier, pkg.effect,
    ]
  );
  const donationId = result.insertId;

  // Auto-approve ถ้าเปิดอยู่
  if (getSettings(venueId).autoApprove) {
    await db.query(`UPDATE donations SET status='QUEUED' WHERE id=?`, [donationId]);
    const [qiResult] = await db.query(
      `INSERT INTO queue_items (donation_id, venue_id, duration_sec, priority) VALUES (?,?,?,?)`,
      [donationId, venueId, pkg.duration_sec, pkg.tier]
    );
    const fullDonation = {
      id: donationId, venue_id: venueId, package_id: packageId,
      display_name: body.display_name || 'Anonymous',
      message: (body.message || '').slice(0, 60),
      ig: body.ig || '', fb: body.fb || '', tiktok: body.tiktok || '',
      image_url: imageUrl,
      amount: pkg.price, duration_sec: pkg.duration_sec, tier: pkg.tier, effect: pkg.effect,
      qi_id: qiResult.insertId,
    };
    getQueue(venueId).push(fullDonation);
    emitState(venueId);
    await startNextIfIdle(venueId);
    return { ok: true, donation: { id: donationId, status: 'QUEUED' } };
  }

  return { ok: true, donation: { id: donationId, status: 'PENDING' } };
});

// --- Upload image ---
fastify.post('/donations/:id/upload', async (req, reply) => {
  const donationId = Number(req.params.id);
  const data = await req.file();
  if (!data) return reply.status(400).send({ ok: false, error: 'no file' });

  const ext      = path.extname(data.filename) || '.jpg';
  const filename = `${donationId}_${Date.now()}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  await fs.promises.writeFile(filepath, await data.toBuffer());

  const imageUrl = `/uploads/${filename}`;
  await db.query(`UPDATE donations SET image_url = ? WHERE id = ?`, [imageUrl, donationId]);

  // Also update image_url in any in-memory queue item or nowPlaying item
  for (const [venueId, q] of queues) {
    const item = q.find((i) => i.id === donationId);
    if (item) { item.image_url = imageUrl; emitState(venueId); }
  }
  for (const [venueId, item] of nowPlaying) {
    if (item && item.id === donationId) { item.image_url = imageUrl; emitState(venueId); }
  }

  return { ok: true, image_url: imageUrl };
});

// --- Get donation status (for donor queue position) ---
fastify.get('/donations/:id', async (req, reply) => {
  const donationId = Number(req.params.id);
  const [[donation]] = await db.query(`
    SELECT d.*, p.name AS package_name,
           qi.id AS qi_id, qi.status AS queue_status, qi.started_at
    FROM donations d
    JOIN packages p ON d.package_id = p.id
    LEFT JOIN queue_items qi ON d.id = qi.donation_id
    WHERE d.id = ?
  `, [donationId]);

  if (!donation) return reply.status(404).send({ ok: false, error: 'not found' });

  let queue_position = null;
  if (donation.qi_id && donation.queue_status === 'WAITING') {
    const [[pos]] = await db.query(`
      SELECT COUNT(*) + 1 AS pos FROM queue_items
      WHERE venue_id = ? AND status = 'WAITING'
        AND created_at < (SELECT created_at FROM queue_items WHERE id = ?)
    `, [donation.venue_id, donation.qi_id]);
    queue_position = pos.pos;
  } else if (donation.queue_status === 'PLAYING') {
    queue_position = 0;
  }

  return { donation, queue_position };
});

// --- List donations (admin) ---
fastify.get('/donations', async (req) => {
  const venueId = Number(req.query.venue_id || 1);
  const status  = req.query.status || 'PENDING';
  const limit   = Math.min(Number(req.query.limit  || 50), 200);
  const offset  = Number(req.query.offset || 0);

  let rows;
  if (status === 'ALL') {
    [rows] = await db.query(
      `SELECT d.*, p.name AS package_name
       FROM donations d
       JOIN packages p ON d.package_id = p.id
       WHERE d.venue_id = ?
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [venueId, limit, offset]
    );
  } else {
    [rows] = await db.query(
      `SELECT d.*, p.name AS package_name
       FROM donations d
       JOIN packages p ON d.package_id = p.id
       WHERE d.venue_id = ? AND d.status = ?
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [venueId, status, limit, offset]
    );
  }
  return { donations: rows };
});

// --- Reject donation ---
fastify.delete('/donations/:id', async (req, reply) => {
  const id = Number(req.params.id);
  const [result] = await db.query(
    `UPDATE donations SET status='REJECTED' WHERE id = ? AND status = 'PENDING'`,
    [id]
  );
  if (result.affectedRows === 0)
    return reply.status(404).send({ ok: false, error: 'not found or already processed' });
  return { ok: true };
});

// --- Approve donation → add to queue ---
fastify.post('/queue/approveById', async (req, reply) => {
  const body    = req.body || {};
  const venueId = Number(body.venue_id || 1);
  const id      = Number(body.id);

  const [[donation]] = await db.query(
    `SELECT * FROM donations WHERE id = ? AND venue_id = ? AND status = 'PENDING'`,
    [id, venueId]
  );
  if (!donation) return reply.status(404).send({ ok: false, error: 'not found or already processed' });

  await db.query(`UPDATE donations SET status='QUEUED' WHERE id = ?`, [id]);

  const [qiResult] = await db.query(
    `INSERT INTO queue_items (donation_id, venue_id, duration_sec, priority) VALUES (?, ?, ?, ?)`,
    [id, venueId, donation.duration_sec, donation.tier || 1]
  );

  // Add to in-memory queue
  const queueItem = { ...donation, qi_id: qiResult.insertId };
  getQueue(venueId).push(queueItem);

  emitState(venueId);
  await startNextIfIdle(venueId);

  return { ok: true };
});

// --- Display state ---
fastify.get('/display/now', async (req) => {
  const venueId = Number(req.query.venue_id || 1);
  if (!queues.has(venueId)) {
    try { await initVenue(venueId); } catch {}
  }
  return {
    venue_id: venueId,
    now:  nowPlaying.get(venueId) || null,
    next: getQueue(venueId).slice(0, 6),
  };
});

// --- Queue status (admin) ---
fastify.get('/queue', async (req) => {
  const venueId = Number(req.query.venue_id || 1);
  return {
    now:  nowPlaying.get(venueId) || null,
    next: getQueue(venueId).slice(0, 10),
  };
});

// --- Revenue summary (admin) ---
fastify.get('/admin/revenue', async (req) => {
  const venueId = Number(req.query.venue_id || 1);

  const [[today]] = await db.query(`
    SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
    FROM donations
    WHERE venue_id = ? AND status NOT IN ('REJECTED','PENDING')
      AND DATE(created_at) = CURDATE()
  `, [venueId]);

  const [[month]] = await db.query(`
    SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
    FROM donations
    WHERE venue_id = ? AND status NOT IN ('REJECTED','PENDING')
      AND MONTH(created_at) = MONTH(CURDATE())
      AND YEAR(created_at) = YEAR(CURDATE())
  `, [venueId]);

  const [byPackage] = await db.query(`
    SELECT p.name, p.tier, p.effect,
           COUNT(d.id) AS count,
           COALESCE(SUM(d.amount),0) AS total
    FROM donations d
    JOIN packages p ON d.package_id = p.id
    WHERE d.venue_id = ? AND d.status NOT IN ('REJECTED','PENDING')
      AND MONTH(d.created_at) = MONTH(CURDATE())
    GROUP BY p.id
    ORDER BY p.tier
  `, [venueId]);

  return { today, month, by_package: byPackage };
});

// ===== Start server =====
const PORT = Number(process.env.PORT || 9000);
fastify.listen({ port: PORT, host: '0.0.0.0' }, async (err, address) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  fastify.log.info(`Server at ${address}`);

  // Socket.IO
  io = new IOServer(fastify.server, {
    cors: { origin: '*', methods: ['GET','POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    fastify.log.info({ sid: socket.id }, 'socket connected');

    socket.on('joinDisplay', async ({ venue_id }) => {
      const vid = Number(venue_id || 1);
      socket.join(`venue_${vid}_display`);

      if (!queues.has(vid)) {
        try { await initVenue(vid); } catch {}
      }

      socket.emit('nowPlaying', {
        now:  nowPlaying.get(vid) || null,
        next: getQueue(vid).slice(0, 6),
      });

      fastify.log.info({ sid: socket.id, vid }, 'joinDisplay');
    });
  });

  // Initialize venue 1 from DB
  try {
    await initVenue(1);
    fastify.log.info('Queue initialized from DB');
  } catch (e) {
    fastify.log.warn({ err: e.message }, 'DB not ready, using empty queue');
  }
});
