require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const qrcode = require('qrcode-terminal');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');
const hbsModule = require('hbs');
const exphbs = require('express-handlebars');

// ====== Database Connection ======
require('./config/db');

// ====== Express App ======
const app = express();

// ====== Handlebars Setup ======
const hbsEngine = exphbs.create({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  helpers: {
    eq: (a, b) => a === b,
    join: (arr, sep) => (Array.isArray(arr) ? arr.join(sep) : ''),
    formatDate: (date) => {
      if (!date) return '';
      const d = new Date(date);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${d.getFullYear()}-${month}-${day}`;
    },
    contains: (value, array) => {
      if (!Array.isArray(array)) return false;
      return array.includes(value);
    },
    formatDateInput: (date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    },
    json: (context) => JSON.stringify(context),

    // ✅ add formatNumber here inside helpers
    formatNumber: (num) => {
      if (!num) return "0";
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(1) + "k";
      return num.toString();
    }
  },
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true
  }
});

// Register partials
hbsModule.registerPartials(path.join(__dirname, 'views/partials'));

// Optional helper for cart totals
hbsModule.registerHelper("reduce", function(cartItems, total) {
  return cartItems.reduce((sum, item) => sum + (item.price || 0), total);
});

hbsModule.registerHelper('eq', function (a, b) {
  return a === b;
});

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Register view engine
app.engine('hbs', hbsEngine.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// ====== Middleware ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(connectLivereload());

// ====== Session Setup ======
app.use(session({
  name: "sevahub_sid",
  secret: process.env.SESSION_SECRET || "verysecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true only for production HTTPS
}));

// ====== Logging Session Info ======
app.use((req, res, next) => {
  console.log("Provider session:", req.session.user, req.session.role);
  next();
});

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ====== Routes ======
app.use("/", require("./routes/main"));
app.use('/', require('./routes/auth'));
app.use('/services', require('./routes/serviceRoutes'));
app.use('/bookings', require('./routes/bookings'));
app.use('/customer', require('./routes/customerDashboard'));
app.use('/cart', require('./routes/cart'));
app.use('/provider', require('./routes/serviceProviderDashboard'));
app.use('/provider', require('./routes/providerRoutes'));  // profile & related routes
app.use("/", require("./routes/search"));


// ====== LiveReload (for development) ======
const liveReloadServer = livereload.createServer();
liveReloadServer.watch(path.join(__dirname, 'views'));
liveReloadServer.watch(path.join(__dirname, 'public'));
liveReloadServer.server.once('connection', () => {
  setTimeout(() => {
    liveReloadServer.refresh('/');
  }, 100);
});

const staticRoutes = require("./routes/static");
app.use("/", staticRoutes);

// ====== HTTPS Setup ======
const httpsOptions = {
  key: fs.readFileSync('localhost+2-key.pem'),
  cert: fs.readFileSync('localhost+2.pem')
};

// ====== Helper to get Local IP ======
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// ====== Start HTTPS Server ======
const PORT = 443;
const HOST = '0.0.0.0';

https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
  const url = `https://localhost`;
  console.log(`🚀 Secure Server running at ${url}`);
});