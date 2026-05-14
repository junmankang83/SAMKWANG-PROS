'use strict';

const fs = require('fs');
const path = require('path');

const src = require.resolve('@samkwang/ui-kit/styles');
const dest = path.join(__dirname, '..', 'public', 'samkwang-ui-kit.css');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
