const { createProxyMiddleware } = require('http-proxy-middleware');

// PUBLIC_INTERFACE
function buildProxy(targetBaseUrl, pathRewrite = undefined) {
  /**
   * Builds a proxy middleware to forward requests to targetBaseUrl.
   * Preserves Authorization and X-Request-Id headers, sets timeouts, and rejects self-signed TLS only if NODE_ENV=production.
   */
  const isProd = process.env.NODE_ENV === 'production';
  return createProxyMiddleware({
    target: targetBaseUrl,
    changeOrigin: true,
    secure: isProd, // in dev allow self-signed
    proxyTimeout: 15000,
    timeout: 15000,
    logLevel: 'warn',
    pathRewrite,
    onProxyReq: (proxyReq, req) => {
      if (req.id) proxyReq.setHeader('X-Request-Id', req.id);
      // Sanitize hop-by-hop headers
      proxyReq.removeHeader?.('connection');
    },
    onError: (err, req, res) => {
      // eslint-disable-next-line no-console
      console.error(`[${req.id}] Proxy error:`, err.message);
      res.status(502).json({
        status: 'error',
        errorCode: 'BAD_GATEWAY',
        message: 'Upstream service unavailable',
        requestId: req.id,
      });
    },
  });
}

module.exports = { buildProxy };
