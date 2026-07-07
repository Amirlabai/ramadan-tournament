'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'local-team-crest-map.json');
const destDir = path.join(__dirname, '..', 'dist');
const dest = path.join(destDir, 'local-team-crest-map.json');

if (!fs.existsSync(src)) {
  throw new Error(`copy-crest-map: source not found: ${src}`);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
