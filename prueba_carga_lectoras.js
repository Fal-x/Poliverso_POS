import autocannon from 'autocannon';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const PATH = process.env.PATH_URL || '/api/v1/esp/activities/validate-and-use';
const UID = process.env.UID || '04A1B2C3D4';
const TERMINAL_ID = process.env.TERMINAL_ID || 'esp32-01';
const CONNECTIONS = Number(process.env.CONNECTIONS || 100);
const DURATION = Number(process.env.DURATION || 30);
const PIPELINING = Number(process.env.PIPELINING || 1);
const MACHINE_PREFIX = process.env.MACHINE_PREFIX || 'ARCADE';
const MACHINE_COUNT = Number(process.env.MACHINE_COUNT || 11);
const FAIL_ON_404 = (process.env.FAIL_ON_404 || 'true').toLowerCase() === 'true';
const TOKEN_TEMPLATES = (process.env.TOKEN_TEMPLATES || 'dev-esp-token-{readerId},dev-esp-token-{activityId}')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const HMAC_TEMPLATES = (
  process.env.HMAC_TEMPLATES ||
  `${process.env.HMAC_SECRET || 'dev-esp-hmac-secret-123456'},dev-esp-hmac-secret-{readerId},dev-esp-hmac-secret-{activityId}`
)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

/**
 * Usa una lista explícita si se provee:
 * PAIRS_JSON='[{"activityId":"ARCADE-01","readerId":"ARCADE-01-R1","apiToken":"dev-esp-token-ARCADE-01-R1","hmacSecret":"dev-esp-hmac-secret-123456"}]'
 */
const RAW_PAIRS = process.env.PAIRS_JSON
  ? JSON.parse(process.env.PAIRS_JSON)
  : Array.from({ length: MACHINE_COUNT }, (_, idx) => {
      const n = String(idx + 1).padStart(2, '0');
      const activityId = `${MACHINE_PREFIX}-${n}`;
      const readerId = `${activityId}-R1`;
      return {
        activityId,
        readerId,
      };
    });

const statusCounter = {};

function signatureFor(body, secret) {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  return crypto.createHmac('sha256', secret).update(bodyHash).digest('base64');
}

function renderTemplate(template, pair) {
  return template.replaceAll('{readerId}', pair.readerId).replaceAll('{activityId}', pair.activityId);
}

function buildCredentialsFor(pair) {
  if (pair.apiToken && pair.hmacSecret) {
    return [{ apiToken: pair.apiToken, hmacSecret: pair.hmacSecret, source: 'PAIRS_JSON explícito' }];
  }

  const tokenTemplates = pair.apiToken
    ? [pair.apiToken]
    : TOKEN_TEMPLATES.map((template) => renderTemplate(template, pair));
  const hmacTemplates = pair.hmacSecret
    ? [pair.hmacSecret]
    : HMAC_TEMPLATES.map((template) => renderTemplate(template, pair));

  const credentials = [];
  const seen = new Set();
  for (const apiToken of tokenTemplates) {
    for (const hmacSecret of hmacTemplates) {
      const key = `${apiToken}:::${hmacSecret}`;
      if (seen.has(key)) continue;
      seen.add(key);
      credentials.push({ apiToken, hmacSecret, source: 'plantillas' });
    }
  }
  return credentials;
}

function buildRequestFor(pair, credentials) {
  const requestId = uuidv4();
  const bodyObj = {
    uid: UID,
    activityId: pair.activityId,
    terminalId: TERMINAL_ID,
    requestId,
  };
  const body = JSON.stringify(bodyObj);
  return {
    method: 'POST',
    path: PATH,
    headers: {
      'Content-Type': 'application/json',
      'x-reader-id': pair.readerId,
      'x-api-token': credentials.apiToken,
      'x-signature': signatureFor(body, credentials.hmacSecret),
    },
    body,
  };
}

async function preflightPair(pair) {
  const candidates = buildCredentialsFor(pair);
  let lastResult = null;

  for (const credentials of candidates) {
    const req = buildRequestFor(pair, credentials);
    const url = `${BASE_URL}${req.path}`;
    const res = await fetch(url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const result = {
      ok: res.status !== 404,
      status: res.status,
      body: parsed,
      credentials,
      candidatesTried: candidates.length,
    };
    lastResult = result;

    if (res.status !== 401 && res.status !== 403) {
      return result;
    }
  }

  return lastResult || { ok: false, status: 0, body: { error: 'Sin candidatos de credenciales' }, candidatesTried: 0 };
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`PATH=${PATH}`);
  console.log(`UID=${UID}`);
  console.log(`CONNECTIONS=${CONNECTIONS} DURATION=${DURATION}s`);
  console.log(`TOKEN_TEMPLATES=${TOKEN_TEMPLATES.join(', ')}`);
  console.log(`HMAC_TEMPLATES=${HMAC_TEMPLATES.join(', ')}`);

  const validPairs = [];
  const authErrors = [];
  const notFoundErrors = [];
  const otherErrors = [];
  for (const pair of RAW_PAIRS) {
    const check = await preflightPair(pair);
    if (check.status === 401 || check.status === 403) {
      authErrors.push({ pair, check });
      continue;
    }
    if (check.status === 404) {
      notFoundErrors.push({ pair, check });
      continue;
    }
    if (check.ok) {
      validPairs.push({
        ...pair,
        apiToken: check.credentials?.apiToken,
        hmacSecret: check.credentials?.hmacSecret,
      });
      console.log(
        `OK preflight: ${pair.readerId} -> ${pair.activityId} [${check.status}] (credenciales: ${check.credentials?.source || 'N/D'})`
      );
    } else {
      otherErrors.push({ pair, check });
      console.log(`SKIP ${check.status}: ${pair.readerId} -> ${pair.activityId}`);
    }
  }

  if (authErrors.length > 0) {
    console.error('\nPreflight AUTH failed (401/403). Corrige token/firma/reader antes de carga.');
    for (const err of authErrors) {
      console.error(
        `- ${err.pair.readerId} -> ${err.pair.activityId} [${err.check.status}] ${JSON.stringify(err.check.body)} (candidatos probados: ${err.check.candidatesTried})`
      );
    }
    console.error(
      'Tip: ajusta TOKEN_TEMPLATES/HMAC_TEMPLATES o usa PAIRS_JSON con apiToken/hmacSecret exactos por lectora.'
    );
    process.exit(1);
  }

  if (FAIL_ON_404 && notFoundErrors.length > 0) {
    console.error('\nPreflight encontró 404 en máquinas/configuraciones.');
    for (const err of notFoundErrors) {
      console.error(`- ${err.pair.readerId} -> ${err.pair.activityId} [404]`);
    }
    console.error('Configura PAIRS_JSON o MACHINE_PREFIX/MACHINE_COUNT para que todas existan.');
    process.exit(1);
  }

  if (!FAIL_ON_404 && notFoundErrors.length > 0) {
    console.log('\nAviso: hay máquinas con 404 y se excluyen de la prueba:');
    for (const err of notFoundErrors) {
      console.log(`- ${err.pair.readerId} -> ${err.pair.activityId}`);
    }
  }

  if (otherErrors.length > 0) {
    console.log('\nAviso: se excluyeron pares por errores de preflight:');
    for (const err of otherErrors) {
      console.log(`- ${err.pair.readerId} -> ${err.pair.activityId} [${err.check.status}]`);
    }
  }

  if (validPairs.length === 0) {
    console.error('\nNo hay pares válidos para ejecutar la carga.');
    console.error('Configura PAIRS_JSON o ACTIVITY_ID/READER_ID/API_TOKEN/HMAC_SECRET con valores existentes en tu BD.');
    process.exit(1);
  }

  console.log(`\nMáquinas válidas para carga: ${validPairs.length}/${RAW_PAIRS.length}`);
  console.log('Modo: round-robin entre todas las máquinas válidas (simultáneo por concurrencia).');

  let pairCursor = 0;

  const instance = autocannon({
    url: BASE_URL,
    connections: CONNECTIONS,
    duration: DURATION,
    pipelining: PIPELINING,
    requests: [
      {
        method: 'POST',
        path: PATH,
        setupRequest: (req) => {
          const pair = validPairs[pairCursor % validPairs.length];
          pairCursor += 1;
          const request = buildRequestFor(pair, {
            apiToken: pair.apiToken,
            hmacSecret: pair.hmacSecret,
          });
          return {
            ...req,
            method: request.method,
            path: request.path,
            headers: request.headers,
            body: request.body,
          };
        },
      },
    ],
  });

  instance.on('response', (_client, statusCode) => {
    statusCounter[statusCode] = (statusCounter[statusCode] || 0) + 1;
  });

  instance.on('error', () => {
    statusCounter.network_error = (statusCounter.network_error || 0) + 1;
  });

  autocannon.track(instance, { renderProgressBar: true });

  instance.on('done', () => {
    console.log('\n===== STATUS CODE SUMMARY =====');
    console.table(statusCounter);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
