module.exports = (req, res, next) => {
  if (req.session.user && req.session.user.role === "service_provider") {
    return next();
  }
  return res.redirect("/login");
};

// ✅ Middleware: ensure provider logged in
function ensureProvider(req, res, next) {
  if (req.session.user && req.session.role === "service_provider") {
    return next();
  }
  return res.status(403).render("error", { message: "Access denied — only for providers" });
}
module.exports = ensureProvider;