const { Tunnel } = require('cloudflared');
const fs = require('fs');
const path = require('path');
const t = Tunnel.quick('http://localhost:8787');
t.once('url', u => {
  fs.writeFileSync(path.join('C:\\Users\\jpmit\\Code\\LunchMeet', '.cf-proxy-url'), u);
  let env = fs.readFileSync('.env','utf8');
  env = env.replace(/EXPO_PUBLIC_PLACES_PROXY_URL=.*/, 'EXPO_PUBLIC_PLACES_PROXY_URL=' + u);
  fs.writeFileSync('.env', env);
  console.log('PROXY:' + u);
});
t.once('error', e => { console.error(e.message); process.exit(1); });
setTimeout(() => { if (!fs.existsSync(path.join('C:\\Users\\jpmit\\Code\\LunchMeet', '.cf-proxy-url'))) { console.error('TIMEOUT'); process.exit(1); } }, 25000);
