import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/KMA_SERVICE_KEY=([^\r\n]+)/);
const serviceKey = match ? match[1].trim() : '';

console.log('KMA Service Key:', serviceKey ? `${serviceKey.substring(0, 10)}... (length: ${serviceKey.length})` : 'NONE');

async function testKma() {
  const url = new URL('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '20');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', '20261110');
  url.searchParams.set('base_time', '1400');
  url.searchParams.set('nx', '57');
  url.searchParams.set('ny', '128');

  console.log('Fetching:', url.toString().replace(serviceKey, 'SERVICE_KEY'));

  try {
    const res = await fetch(url.toString());
    console.log('HTTP Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response body preview:\n', text.substring(0, 500));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testKma();

