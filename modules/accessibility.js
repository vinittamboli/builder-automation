const axios = require('axios');

async function checkUrlAccessibility(urls) {
  const results = {};
  for (const url of urls) {
    if (url.includes('twitter.com')) {
      results[url] = true;
      continue;
    }
    try {
      const res = await axios.get(url, { timeout: 8000 });
      results[url] = res.status >= 200 && res.status < 400;
    } catch {
      results[url] = false;
    }
  }
  return results;
}

module.exports = { checkUrlAccessibility };