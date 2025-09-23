const fs = require('fs');
const path = require('path');
const { withServers } = require('./src/docs/openapi');

const outputDir = path.join(__dirname, 'interfaces');
const outputPath = path.join(outputDir, 'openapi.json');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build a localhost spec
const fakeReq = {
  get: () => 'localhost:3000',
  socket: { localPort: 3000 },
  protocol: 'http',
  secure: false,
};
const spec = withServers(fakeReq);

fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
