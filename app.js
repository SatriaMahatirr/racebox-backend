require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');
const db = require('./models/db');

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/admin/assets', express.static(path.join(__dirname, 'public/admin')));
app.use(session({ secret: process.env.SESSION_SECRET || 'racebox-dev-session-secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 } }));
app.use(morgan('dev'));

app.get('/', (_req, res) => res.redirect('/admin'));

app.use('/admin', require('./routes/admin-web'));

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ success: true, message: 'RaceBox API aktif', database: 'connected' }); }
  catch (e) { res.status(503).json({ success: false, message: 'Database tidak terhubung' }); }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/races', require('./routes/races'));
app.use('/api/admin', require('./routes/admin'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.', code: 'SERVER_ERROR' });
});

const port = Number(process.env.PORT || 3000);
db.getConnection().then(c => { c.release(); app.listen(port, () => console.log(`RaceBox API: http://localhost:${port}`)); })
  .catch(err => { console.error('MySQL gagal:', err.message); process.exit(1); });
