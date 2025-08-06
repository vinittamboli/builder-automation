function waitRandom(min = 5000, max = 15000) {
  const time = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(res => setTimeout(res, time));
}

module.exports = { waitRandom };