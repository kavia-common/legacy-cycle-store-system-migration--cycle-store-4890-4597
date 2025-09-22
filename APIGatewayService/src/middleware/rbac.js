function forbidden(res, requestId, message = 'Forbidden') {
  return res.status(403).json({
    status: 'error',
    errorCode: 'FORBIDDEN',
    message,
    requestId,
  });
}

// PUBLIC_INTERFACE
function requireRoles(allowedRoles = []) {
  /** Enforces that req.user.roles intersects allowedRoles. If allowedRoles empty, allows any authenticated user. */
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, req.id, 'Missing authenticated user');
    }
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      return next();
    }
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const ok = allowedRoles.some((r) => userRoles.includes(r));
    if (!ok) {
      return forbidden(res, req.id, 'Insufficient role');
    }
    return next();
  };
}

module.exports = { requireRoles };
