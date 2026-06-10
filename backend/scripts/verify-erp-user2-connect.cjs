/**
 * One-off: parse ../.env (quoted PASSWORD2) and try MSSQL USER2 login.
 * Run: node scripts/verify-erp-user2-connect.cjs
 */
const fs = require('fs');
const path = require('path');
const mssql = require('mssql');

function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val
        .slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\\$/g, '$');
    }
    out[key] = val;
  }
  return out;
}

/** 백엔드 `normalizeErpMssqlUser2Login`과 동일: 과거 오타 skkracc → skkrace */
function normalizeErpMssqlUser2Login(login) {
  if (login == null || typeof login !== 'string') return login;
  const t = login.trim();
  if (!t) return t;
  return t.toLowerCase() === 'skkracc' ? 'skkrace' : t;
}

async function main() {
  const envPath = path.join(__dirname, '../../.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = parseEnvFile(raw);
  const host = env.ERP_MSSQL_HOST;
  const port = Number(env.ERP_MSSQL_PORT) || 1433;
  const database = env.ERP_MSSQL_DATABASE;
  const user = normalizeErpMssqlUser2Login(env.ERP_MSSQL_USER2);
  const password = env.ERP_MSSQL_PASSWORD2;
  console.log('parsed ERP_MSSQL_PASSWORD2 length:', password ? password.length : 0);
  if (!host || !database || !user || !password) {
    console.error('Missing HOST, DATABASE, USER2, or PASSWORD2');
    process.exit(1);
  }
  const pool = new mssql.ConnectionPool({
    server: host,
    port,
    database,
    user,
    password,
    options: {
      encrypt: env.ERP_MSSQL_ENCRYPT === 'true',
      trustServerCertificate: env.ERP_MSSQL_TRUST_SERVER_CERT !== 'false',
    },
    connectionTimeout: 15000,
  });
  try {
    await pool.connect();
    console.log('USER2_connect_OK');
    await pool.close();
  } catch (e) {
    console.error('USER2_connect_FAIL:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
