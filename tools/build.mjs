// Assembles the single-file game: src/shell.html + src/engine/*.js -> index.html
// The phone build must stay one HTML file (module scripts cannot load from file://).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_VERSION = '0.169.0';
const importMap = {
  imports: {
    three: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
    'three/addons/': `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/`,
  },
};

const engineDir = join(root, 'src', 'engine');
const parts = readdirSync(engineDir).filter(f => f.endsWith('.js')).sort();
const engine = parts.map(f => `// ===== ${f} =====\n` + readFileSync(join(engineDir, f), 'utf8')).join('\n');
if (engine.includes('</script')) throw new Error('engine source must not contain a closing script tag');

const shell = readFileSync(join(root, 'src', 'shell.html'), 'utf8');
if (!shell.includes('<!--ENGINE-->')) throw new Error('shell.html is missing the <!--ENGINE--> marker');
const html = shell.replace('<!--ENGINE-->',
  `<script type="importmap">${JSON.stringify(importMap)}</script>\n<script type="module">\n${engine}\n</script>`);

writeFileSync(join(root, 'index.html'), html);
console.log(`index.html: ${(html.length / 1024).toFixed(1)} KB from ${parts.length} engine parts`);
