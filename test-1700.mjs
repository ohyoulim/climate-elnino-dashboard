import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/KMA_SERVICE_KEY=([^\r\n]+)/);
const serviceKey = match ? match[1].trim() : '';

async function test1700() {
  const url = new URL('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '20');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', '20261110');
  url.searchParams.set('base_time', '1700');
  url.searchParams.set('nx', '57');
  url.searchParams.set('ny', '128');

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    console.log('1700 Header:', data?.response?.header);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

test1700();

