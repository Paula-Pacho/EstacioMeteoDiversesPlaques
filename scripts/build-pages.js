/**
 * Genera les pàgines d'escola (escola-*.html, zer-moianes.html, citilab.html)
 * a partir de la plantilla escola.html i de js/config.js.
 *
 * Per afegir una escola: crea-la a js/config.js (amb el camp `page`) i executa
 *     npm run build-pages
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');

const ROOT = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(ROOT, 'escola.html'), 'utf8');
const version = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const school of Object.values(CONFIG.schools)) {
    if (!school.page) { console.warn(`⚠️ ${school.id}: sense camp "page", s'omet`); continue; }

    let html = template
        .replace('<body data-school="">', `<body data-school="${school.id}">`)
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(school.name)} | Meteo:bit</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/,
                 `$1Dades meteorològiques en temps real - ${esc(school.name)} (${esc(school.location)})$2`)
        // invalida la cache del navegador quan canvien els scripts
        .replace(/(<script src="js\/[\w-]+\.js)(")/g, `$1?v=${version}$2`);

    fs.writeFileSync(path.join(ROOT, school.page), html);
    console.log(`✅ ${school.page}  (${school.id})`);
}
