/**
 * Arxiu de dades de ThingSpeak → data/<escola>/YYYY-MM.json
 *
 * - Llegeix les escoles de js/config.js (única font de veritat).
 * - Desa MITJANES HORÀRIES (no dades crues cada 20 s): ~720 files/mes i escola
 *   en comptes de ~130.000, així el repositori no creix sense control.
 * - És incremental: només demana des de l'última hora desada.
 * - No esborra mai dades antigues.
 *
 * Claus (opcionals): ESCOLA<n>_CHANNEL_ID / ESCOLA<n>_API_KEY com a secrets
 * de GitHub. Si no hi són, s'usa el que hi ha a config.js (canals públics
 * no necessiten clau).
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');

const BASE_URL = 'https://api.thingspeak.com/channels';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ARCHIVE_FROM = new Date(CONFIG.storage.archiveFrom || '2026-04-13T00:00:00Z');
const PAGE_SIZE = 8000;
const MAX_FIELDS = 8;

const isPlaceholder = (v) => !v || String(v).startsWith('YOUR_');

function schoolCredentials(school) {
    const n = school.id.replace(/^escola/, '');
    const channelId = process.env[`ESCOLA${n}_CHANNEL_ID`] || school.thingspeak.channelId;
    const apiKey = process.env[`ESCOLA${n}_API_KEY`] || school.thingspeak.readApiKey;
    return { channelId, apiKey: isPlaceholder(apiKey) ? null : apiKey };
}

const monthKey = (iso) => iso.slice(0, 7); // YYYY-MM en UTC (ThingSpeak torna ISO en UTC)

function readMonth(dir, month) {
    const file = path.join(dir, `${month}.json`);
    if (!fs.existsSync(file)) return [];
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { console.error(`⚠️ ${file} il·legible, es refà:`, e.message); return []; }
}

function writeMonth(dir, month, rows) {
    // Una fila per línia: diffs de git llegibles i fitxers compactes
    const body = '[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n';
    fs.writeFileSync(path.join(dir, `${month}.json`), body);
}

function lastStoredTimestamp(dir) {
    const months = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
    for (let i = months.length - 1; i >= 0; i--) {
        const rows = readMonth(dir, months[i].replace('.json', ''));
        if (rows.length) return new Date(rows[rows.length - 1].timestamp);
    }
    return null;
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function collectSchool(school) {
    const { channelId, apiKey } = schoolCredentials(school);
    if (isPlaceholder(channelId)) {
        console.log(`⏭️  ${school.id}: sense canal configurat`);
        return { skipped: true };
    }

    const dir = path.join(DATA_DIR, school.id);
    fs.mkdirSync(dir, { recursive: true });

    // Reprenem una hora enrere per refer l'última mitjana, que podia ser parcial
    const last = lastStoredTimestamp(dir);
    let cursor = last ? new Date(last.getTime() - 3600 * 1000) : ARCHIVE_FROM;
    if (cursor < ARCHIVE_FROM) cursor = ARCHIVE_FROM;

    let channel = null;
    const fresh = new Map(); // timestamp → fila
    for (let page = 0; page < 50; page++) {
        const params = new URLSearchParams({ results: PAGE_SIZE, average: 60, round: 2, start: cursor.toISOString() });
        if (apiKey) params.set('api_key', apiKey);
        const data = await fetchJson(`${BASE_URL}/${channelId}/feeds.json?${params}`);
        channel = channel || data.channel;
        const feeds = data.feeds || [];
        if (!feeds.length) break;

        for (const f of feeds) {
            const row = { timestamp: f.created_at };
            let hasValue = false;
            for (let i = 1; i <= MAX_FIELDS; i++) {
                const raw = f[`field${i}`];
                const v = raw === null || raw === undefined || raw === '' ? null : parseFloat(raw);
                if (v !== null && !Number.isNaN(v)) { row[`field${i}`] = v; hasValue = true; }
            }
            if (hasValue) fresh.set(f.created_at, row);
        }
        if (feeds.length < PAGE_SIZE) break;
        cursor = new Date(new Date(feeds[feeds.length - 1].created_at).getTime() + 1000);
    }

    // Fusionar amb el que ja hi havia (el nou preval) i desar per mes
    const byMonth = new Map();
    for (const row of fresh.values()) {
        const m = monthKey(row.timestamp);
        if (!byMonth.has(m)) byMonth.set(m, []);
        byMonth.get(m).push(row);
    }
    let added = 0;
    for (const [m, rows] of byMonth) {
        const merged = new Map(readMonth(dir, m).map((r) => [r.timestamp, r]));
        const before = merged.size;
        rows.forEach((r) => merged.set(r.timestamp, r));
        added += merged.size - before;
        const sorted = [...merged.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        writeMonth(dir, m, sorted);
    }

    if (channel) {
        const info = { id: channel.id, name: channel.name, description: channel.description,
            latitude: channel.latitude, longitude: channel.longitude, created_at: channel.created_at,
            updated_at: channel.updated_at, last_entry_id: channel.last_entry_id };
        for (let i = 1; i <= MAX_FIELDS; i++) if (channel[`field${i}`]) info[`field${i}`] = channel[`field${i}`];
        fs.writeFileSync(path.join(dir, 'channel-info.json'), JSON.stringify(info, null, 2));
    }
    console.log(`✅ ${school.id}: ${fresh.size} hores rebudes, ${added} de noves`);
    return { skipped: false };
}

async function main() {
    console.log(`🌤️ Recollida de dades — ${new Date().toISOString()}`);
    let ok = 0, failed = 0;
    for (const school of Object.values(CONFIG.schools)) {
        if (school.active === false) continue;
        try {
            const r = await collectSchool(school);
            if (!r.skipped) ok++;
        } catch (e) {
            failed++;
            console.error(`❌ ${school.id}: ${e.message}`);
        }
    }
    console.log(`\nAcabat: ${ok} correctes, ${failed} amb error`);
    // Només fallem el workflow si TOTES les escoles configurades han fallat
    if (failed > 0 && ok === 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
