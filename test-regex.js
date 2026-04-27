const regex1 = /(?:429|rate limit|quota).*?(?:reset after|try again in|wait)\s*(\d+)\s*([smh])/i;

function extractWaitTimeMs(errorText) {
  const match = errorText.match(regex1);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60000;
  if (unit === 'h') return value * 3600000;
  return null;
}

console.log(extractWaitTimeMs("Error: Cloud Code Assist API error (429): You have exhausted your capacity on this model. Your quota will reset after 58s."));
console.log(extractWaitTimeMs("Rate limit exceeded. Try again in 2m."));
console.log(extractWaitTimeMs("429 Too Many Requests. Please wait 1h before trying again."));
