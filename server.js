
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

const app = express();
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Log = mongoose.model('Log', {
  name: String,
  role: String,
  type: String,
  time: Date
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(session({
  secret: 'altinyildizSecretKey',
  resave: false,
  saveUninitialized: true
}));

const USERS = [
  { username: 'altinyildiz.k50', password: 'altinyildiz.5050' }
];

function auth(req, res, next) {
  if (req.session && req.session.user) return next();
  else return res.redirect('/login.html');
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (user) {
    req.session.user = user.username;
    res.redirect('/adminpanel');
  } else {
    res.send('❌ Giriş bilgileri yanlış.');
  }
});

app.post('/submit', async (req, res) => {
  const { name, role, type, time } = req.body;
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000);

  const recent = await Log.findOne({
    name,
    type,
    time: { $gt: thirtyMinutesAgo }
  });

  if (recent) {
    return res.send("⚠️ Uyarı: Aynı işlemi kısa sürede tekrar yapamazsınız.");
  }

  const log = new Log({ name, role, type, time: new Date(time) });
  await log.save();
  res.send("✅ Kayıt başarıyla alındı.");
});

app.get('/adminpanel', auth, async (req, res) => {
  const logs = await Log.find().sort({ time: -1 });
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.time.toISOString().startsWith(today));
  const count = todayLogs.length;

  let html = `
  <html><head><meta charset="UTF-8">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body class="p-4">
  <div class="container">
  <h2>📊 Altınyıldız Giriş/Çıkış Kayıtları</h2>
  <p>Bugünkü toplam kayıt: <strong>${count}</strong></p>
  <form method="GET" action="/adminpanel" class="row g-3 mb-3">
    <div class="col-auto"><input type="text" name="search" class="form-control" placeholder="İsim ara"></div>
    <div class="col-auto"><input type="date" name="date" class="form-control"></div>
    <div class="col-auto"><button type="submit" class="btn btn-primary">Filtrele</button></div>
  </form>
  <a href="/download/pdf" class="btn btn-danger btn-sm me-2">PDF indir</a>
  <a href="/download/csv" class="btn btn-success btn-sm">Excel indir</a>
  <table class="table table-striped mt-3">
    <thead><tr><th>İsim</th><th>Görev</th><th>İşlem</th><th>Saat</th></tr></thead><tbody>
  `;

  logs.forEach(l => {
    html += `<tr><td>${l.name}</td><td>${l.role}</td><td>${l.type}</td><td>${new Date(l.time).toLocaleString()}</td></tr>`;
  });

  html += `</tbody></table></div></body></html>`;
  res.send(html);
});

app.get('/download/pdf', auth, async (req, res) => {
  const logs = await Log.find().sort({ time: -1 });

  const doc = new PDFDocument();
  const filename = "kayitlar.pdf";
  res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('Content-type', 'application/pdf');
  doc.pipe(res);

  doc.fontSize(18).text('Altınyıldız Giriş/Çıkış Kayıtları', { align: 'center' });
  doc.moveDown();

  logs.forEach(log => {
    doc.fontSize(12).text(`${log.name} | ${log.role} | ${log.type} | ${new Date(log.time).toLocaleString()}`);
  });

  doc.end();
});

app.get('/download/csv', auth, async (req, res) => {
  const logs = await Log.find().sort({ time: -1 });
  const parser = new Parser({ fields: ['name', 'role', 'type', 'time'] });
  const csv = parser.parse(logs);
  res.header('Content-Type', 'text/csv');
  res.attachment('kayitlar.csv');
  return res.send(csv);
});

app.listen(3000, () => {
  console.log('Sunucu http://localhost:3000 adresinde çalışıyor');
});
