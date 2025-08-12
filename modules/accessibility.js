// modules/accessibility.js
const axios = require('axios');

const AX = axios.create({
  maxRedirects: 5,
  timeout: 10000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  validateStatus: () => true, // we'll decide by status code
});

function isWhitelisted(url) {
  return /(^|\/\/)(x\.com|twitter\.com|reddit\.com)\b/i.test(url);
}

function ok(status) {
  return status >= 200 && status < 400; // 2xx/3xx OK
}

async function checkOne(url) {
  if (isWhitelisted(url)) return true;

  try {
    const h = await AX.head(url);
    if (ok(h.status)) return true;
  } catch (_) {
    // ignore, fall through to GET
  }
  try {
    const g = await AX.get(url);
    return ok(g.status);
  } catch (_) {
    return false;
  }
}

async function checkUrlAccessibility(urls) {
  const results = {};
  for (const url of urls) {
    try {
      results[url] = await checkOne(url);
    } catch {
      results[url] = false;
    }
  }
  return results;
}

module.exports = { checkUrlAccessibility };
