import { NextRequest, NextResponse } from 'next/server';

export type AlertLevel = '정상' | '주의' | '경고' | '심각';
export type ScenarioType = 'realtime' | 'composite' | 'heavy_rain' | 'cold_wave' | 'normal';

export interface HourlyWeather {
  time: string; // "HH:mm"
  fullDate: string;
  temp: number; // T1H / TMP (℃)
  rain: number; // RN1 / PCP (mm)
  pop: number;  // 강수확률 (%)
  pty: string;  // 강수형태
  sky: string;  // 하늘상태 (맑음/구름많음/흐림)
  isExtreme: boolean;
  alertLevel: AlertLevel;
  extremeReasons: string[];
}

export interface RegionRisk {
  name: string;
  code: string;
  rain: number;
  temp: number;
  alertLevel: AlertLevel;
  riskDescription: string;
  isFloodingRisk: boolean;
  isColdWaveRisk: boolean;
}

export interface MonthlyClimateInfo {
  month: number;
  season: '봄' | '여름' | '가을' | '겨울';
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  maxRainHourly: number;
  primaryRisk: string;
}

export interface WeatherResponse {
  success: boolean;
  scenario: ScenarioType;
  location: {
    city: string;
    nx: number;
    ny: number;
  };
  baseDateTime: string;
  currentMonth: number;
  monthlyNormal: MonthlyClimateInfo;
  isMock: boolean;
  message?: string;
  hourly: HourlyWeather[];
  summary: {
    currentTemp: number; // 현재 시점 기준 기온
    maxTemp: number;
    minTemp: number;
    tempDropMax24h: number;
    maxRain: number;
    totalRain: number;
    elninoAlertLevel: AlertLevel;
    hasExtremeWeather: boolean;
    hasColdWave: boolean;
    hasHeavyRain: boolean;
    hasHeatWave: boolean;
    extremeCount: number;
    extremeAlerts: string[];
  };
  regions: RegionRisk[];
}

const GOYANG_NX = 57;
const GOYANG_NY = 128;

/**
 * 대한민국 기상청(KMA) 1991~2020년 30년 신(新) 기후평년값 테이블
 * (고양시 및 경기 서북부 관측소 기준 월별 30년 표준 통계치)
 */
const MONTHLY_CLIMATE_NORMALS: Record<number, MonthlyClimateInfo> = {
  1:  { month: 1,  season: '겨울', avgTemp: -2.4, minTemp: -6.9, maxTemp: 2.1,  maxRainHourly: 1.5, primaryRisk: '혹한기 한파 및 대설' },
  2:  { month: 2,  season: '겨울', avgTemp: 0.4,  minTemp: -4.5, maxTemp: 5.3,  maxRainHourly: 2.0, primaryRisk: '해빙기 기온 급변' },
  3:  { month: 3,  season: '봄',   avgTemp: 6.2,  minTemp: 0.8,  maxTemp: 11.6, maxRainHourly: 3.5, primaryRisk: '꽃샘추위 및 건조 돌풍' },
  4:  { month: 4,  season: '봄',   avgTemp: 12.8, minTemp: 7.0,  maxTemp: 18.6, maxRainHourly: 6.0, primaryRisk: '일교차 극심 및 봄가뭄' },
  5:  { month: 5,  season: '봄',   avgTemp: 18.2, minTemp: 12.8, maxTemp: 23.7, maxRainHourly: 9.0, primaryRisk: '때이른 초여름 고온' },
  6:  { month: 6,  season: '여름', avgTemp: 22.7, minTemp: 18.2, maxTemp: 27.5, maxRainHourly: 16.0, primaryRisk: '장마 전선 및 국지성 호우' },
  7:  { month: 7,  season: '여름', avgTemp: 25.7, minTemp: 22.2, maxTemp: 29.6, maxRainHourly: 26.5, primaryRisk: '슈퍼 엘니뇨 극한 폭우 및 열대야' },
  8:  { month: 8,  season: '여름', avgTemp: 26.1, minTemp: 22.4, maxTemp: 30.2, maxRainHourly: 25.0, primaryRisk: '게릴라성 호우 및 극한 폭염' },
  9:  { month: 9,  season: '가을', avgTemp: 21.6, minTemp: 16.7, maxTemp: 26.2, maxRainHourly: 13.5, primaryRisk: '가을 태풍 및 집중호우' },
  10: { month: 10, season: '가을', avgTemp: 15.0, minTemp: 9.6,  maxTemp: 20.4, maxRainHourly: 5.5, primaryRisk: '기습 찬공기 및 첫서리' },
  11: { month: 11, season: '가을', avgTemp: 7.2,  minTemp: 2.3,  maxTemp: 12.2, maxRainHourly: 3.0, primaryRisk: '슈퍼 엘니뇨 극한 강우 & 기습 한파' },
  12: { month: 12, season: '겨울', avgTemp: 0.1,  minTemp: -4.4, maxTemp: 4.5,  maxRainHourly: 2.0, primaryRisk: '북극발 북극 한기 급습' },
};

function getLatestBaseTime(now: Date) {
  const kstOffset = 9 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + kstOffset * 60000);

  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let targetDate = new Date(kst);
  let hour = kst.getHours();
  const minute = kst.getMinutes();

  // 기상청 단기예보는 매 발표 시각 10~15분 이후 API 오픈 (기존 40분 버퍼 -> 15분으로 단축)
  if (minute < 15) hour -= 1;

  let selectedBaseHour = -1;
  for (let i = baseHours.length - 1; i >= 0; i--) {
    if (hour >= baseHours[i]) {
      selectedBaseHour = baseHours[i];
      break;
    }
  }

  if (selectedBaseHour === -1) {
    targetDate.setDate(targetDate.getDate() - 1);
    selectedBaseHour = 23;
  }

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return {
    baseDate: `${yyyy}${mm}${dd}`,
    baseTime: `${String(selectedBaseHour).padStart(2, '0')}00`,
    month: targetDate.getMonth() + 1,
  };
}

function parsePrecipitation(val: string | number | undefined): number {
  if (typeof val === 'number') return val;
  if (!val || val === '강수없음') return 0;
  if (val.includes('미만')) return 0.5;
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

function parseSky(code: string | undefined): string {
  switch (code) {
    case '1': return '맑음';
    case '3': return '구름많음';
    case '4': return '흐림';
    default: return '맑음';
  }
}

function parsePty(code: string | undefined): string {
  switch (code) {
    case '0': return '없음';
    case '1': return '비';
    case '2': return '비/눈';
    case '3': return '눈';
    case '4': return '소나기';
    default: return '없음';
  }
}

/**
 * 12개월 전천후 사계절 이상기후 감지 알고리즘:
 * - 현재 월의 기상청 30년 평년값(MONTHLY_CLIMATE_NORMALS[currentMonth])과 실시간 비교
 * - 동절기/환절기 (10월~4월): 기상청 법정 한파특보(10℃/15℃ 강하) 적용
 * - 하절기 (5월~9월): 호우특보(30mm/50mm) 및 폭염특보(33℃/35℃) 적용
 * - 엘니뇨 특이 기후: 평년 시간당 강우 대비 5배~10배 초과 시 즉시 경보
 */
function evaluateSeasonalExtremeCondition(
  temp: number,
  rain: number,
  prevTemp: number | null,
  dayMaxTemp: number,
  normal: MonthlyClimateInfo
): { isExtreme: boolean; alertLevel: AlertLevel; reasons: string[] } {
  const reasons: string[] = [];
  let alertLevel: AlertLevel = '정상';

  // 1. 강수량 평가 (평년 월 강수 강도 및 기상청 호우 기준 동적 결합)
  // 평년 강수량 대비 5배 이상 또는 기상청 특보 절대 기준치 초과
  const rainThresholdSevere = Math.max(normal.maxRainHourly * 5, 50);
  const rainThresholdWarning = Math.max(normal.maxRainHourly * 3, 30);
  const rainThresholdWatch = Math.max(normal.maxRainHourly * 2, 15);

  if (rain >= rainThresholdSevere) {
    alertLevel = '심각';
    reasons.push(`슈퍼 엘니뇨 극한 강우 (시간당 ${rain}mm ≥ ${rainThresholdSevere}mm, 대규모 침수)`);
  } else if (rain >= rainThresholdWarning) {
    alertLevel = '경고';
    reasons.push(`호우경보급 집중호우 (시간당 ${rain}mm ≥ ${rainThresholdWarning}mm, 평년의 5배 이상)`);
  } else if (rain >= rainThresholdWatch) {
    alertLevel = '주의';
    reasons.push(`기습 폭우 주의보 (시간당 ${rain}mm ≥ ${rainThresholdWatch}mm, 평년 초과)`);
  }

  // 2. 기습 한파 평가 (10월~4월 동절기/환절기 기상청 법정 기준)
  if (normal.month >= 10 || normal.month <= 4) {
    // 1시간 내 급격한 기온 하강 (-3℃/h)
    if (prevTemp !== null && (prevTemp - temp) >= 3) {
      const drop = (prevTemp - temp).toFixed(1);
      if (alertLevel === '정상') alertLevel = '주의';
      reasons.push(`1시간 급격 기온 강하 (-${drop}℃/h)`);
    }

    // 전일 또는 당일 최고 대비 강하폭 (한파특보 법정 기준식)
    const dropFromMax = dayMaxTemp - temp;
    // 한파경보: 15℃ 이상 하강 & 평년 최저 이하로 영하권 진입
    if (dropFromMax >= 15 && temp <= normal.minTemp) {
      alertLevel = '심각';
      reasons.push(`기상청 한파경보 기준 도달 (-${dropFromMax.toFixed(1)}℃ 폭락, 평년 최저 ${normal.minTemp}℃ 하회)`);
    }
    // 한파주의보: 10℃ 이상 하강 & 3℃ 이하
    else if (dropFromMax >= 10 && temp <= 3) {
      if (alertLevel !== '심각') alertLevel = '경고';
      reasons.push(`기상청 한파주의보 기준 도달 (-${dropFromMax.toFixed(1)}℃ 급락, 최저 3℃ 이하)`);
    }
  }

  // 3. 하절기 폭염 평가 (6월~8월 하절기 기준)
  if (normal.month >= 6 && normal.month <= 8) {
    if (temp >= 35) {
      alertLevel = '심각';
      reasons.push(`기상청 폭염경보 발령 기준 (현재 기온 ${temp}℃ ≥ 35℃)`);
    } else if (temp >= 33) {
      if (alertLevel === '정상') alertLevel = '경고';
      reasons.push(`기상청 폭염주의보 발령 기준 (현재 기온 ${temp}℃ ≥ 33℃)`);
    }
  }

  return {
    isExtreme: reasons.length > 0,
    alertLevel,
    reasons,
  };
}

function generateRegionalRisk(
  currentTemp: number,
  minTemp: number,
  maxRain: number,
  tempDrop: number,
  mainLevel: AlertLevel
): RegionRisk[] {
  // 지리적 위도 및 지형에 따른 권역별 미기후 보정
  const dongTemp = parseFloat(currentTemp.toFixed(1));
  const seoTemp = parseFloat((currentTemp - 0.5).toFixed(1));
  const deokyangTemp = parseFloat((currentTemp - 1.0).toFixed(1));
  const pajuTemp = parseFloat((currentTemp - 2.5).toFixed(1));

  // 전체 기상 관측 상 '정상' 단계이거나 특보급 강우/한파가 없는 경우 모든 권역을 정상 단계로 확정
  const isGlobalNormal = mainLevel === '정상' && maxRain < 15;

  // 각 권역별 기상청 법정 특보 기준에 따른 정밀 단계 판정 함수
  const evaluateRisk = (regRain: number, regTemp: number): {
    alertLevel: AlertLevel;
    isFloodingRisk: boolean;
    isColdWaveRisk: boolean;
  } => {
    // 평년 정상이거나 특보 기준 미만일 경우 무조건 정상 반환
    if (isGlobalNormal) {
      return { alertLevel: '정상', isFloodingRisk: false, isColdWaveRisk: false };
    }

    // 1. 강수 특보 기준 (기상청 법정 기준: 15mm 주의보, 30mm 경보, 50mm 극한호우)
    let rainLevel: AlertLevel = '정상';
    if (regRain >= 50) rainLevel = '심각';
    else if (regRain >= 30) rainLevel = '경고';
    else if (regRain >= 15) rainLevel = '주의';

    // 2. 한파 특보 기준 (기상청 법정 기준: 10℃ 이상 기온 폭락 & 영하/빙점 근접 3℃ 이하)
    // 자연스러운 일교차(낮과 밤의 차이)는 한파가 아니므로, 실제 한파 기준을 엄격히 적용
    let coldLevel: AlertLevel = '정상';
    if (tempDrop >= 15 && regTemp <= 0) {
      coldLevel = '심각'; // 한파경보급 (15℃ 이상 폭락 & 영하권)
    } else if (tempDrop >= 10 && regTemp <= 3) {
      coldLevel = '경고'; // 한파주의보급 (10℃ 이상 폭락 & 3℃ 이하)
    }

    const order: Record<AlertLevel, number> = { '정상': 0, '주의': 1, '경고': 2, '심각': 3 };
    const alertLevel = order[rainLevel] >= order[coldLevel] ? rainLevel : coldLevel;

    return {
      alertLevel,
      isFloodingRisk: regRain >= 15,
      isColdWaveRisk: tempDrop >= 10 && regTemp <= 3,
    };
  };

  const dong = evaluateRisk(maxRain, dongTemp);
  const seo = evaluateRisk(parseFloat((maxRain * 0.95).toFixed(1)), seoTemp);
  const deokyang = evaluateRisk(parseFloat((maxRain * 1.1).toFixed(1)), deokyangTemp);
  const paju = evaluateRisk(parseFloat((maxRain * 0.85).toFixed(1)), pajuTemp);

  return [
    {
      name: '고양시 일산동구',
      code: 'GOYANG_ILSAN_DONG',
      rain: maxRain,
      temp: dongTemp,
      alertLevel: dong.alertLevel,
      riskDescription: dong.isFloodingRisk
        ? '도심 저지대 지하차도 및 배수취약구역 침수 위험'
        : dong.isColdWaveRisk
        ? '급격한 기온 하강에 따른 도심 수도 배관 동파 유의'
        : '정상 통행 가능 (기상 이변 없음)',
      isFloodingRisk: dong.isFloodingRisk,
      isColdWaveRisk: dong.isColdWaveRisk,
    },
    {
      name: '고양시 일산서구 (대화/가좌)',
      code: 'GOYANG_ILSAN_SEO',
      rain: parseFloat((maxRain * 0.95).toFixed(1)),
      temp: seoTemp,
      alertLevel: seo.alertLevel,
      riskDescription: seo.isFloodingRisk
        ? '한강 수위 상승 및 농경지 배수로 역류 대비 필요'
        : seo.isColdWaveRisk
        ? '저지대 찬 공기 정체로 인한 농작물 저온 피해 유의'
        : '평년 수위 유지 (배수로 통행 정상)',
      isFloodingRisk: seo.isFloodingRisk,
      isColdWaveRisk: seo.isColdWaveRisk,
    },
    {
      name: '고양시 덕양구 (화전/삼송)',
      code: 'GOYANG_DEOKYANG',
      rain: parseFloat((maxRain * 1.1).toFixed(1)),
      temp: deokyangTemp,
      alertLevel: deokyang.alertLevel,
      riskDescription: deokyang.isFloodingRisk
        ? '창릉천 주변 수위 급상승 및 저지대 침수 우려'
        : deokyang.isColdWaveRisk
        ? '시설 비닐하우스 밀집지 급랭 및 냉해 피해 주의'
        : '시설 하우스 적정 온습도 유지 (안정 범위)',
      isFloodingRisk: deokyang.isFloodingRisk,
      isColdWaveRisk: deokyang.isColdWaveRisk,
    },
    {
      name: '파주시 문산·교하권역',
      code: 'PAJU_BORDER',
      rain: parseFloat((maxRain * 0.85).toFixed(1)),
      temp: pajuTemp,
      alertLevel: paju.alertLevel,
      riskDescription: paju.isColdWaveRisk
        ? '북극발 기습 한기 최우선 유입 및 농작물 동해 위험'
        : paju.isFloodingRisk
        ? '임진강 지류 수위 상승 및 저지대 배수 유의'
        : '평년 기후 범위 유지 (동해 및 침수 위험 없음)',
      isFloodingRisk: paju.isFloodingRisk,
      isColdWaveRisk: paju.isColdWaveRisk,
    },
  ];
}

// 사계절 시나리오별 모의 데이터 생성
function generateMockByScenario(scenario: ScenarioType, currentMonth: number): HourlyWeather[] {
  const result: HourlyWeather[] = [];
  const now = new Date();
  const normal = MONTHLY_CLIMATE_NORMALS[currentMonth] || MONTHLY_CLIMATE_NORMALS[11];

  let baseTemps: number[] = [];
  let baseRains: number[] = [];

  if (scenario === 'heavy_rain') {
    baseTemps = [19, 18, 18, 17, 17, 18, 20, 21, 22, 23, 23, 22, 21, 20, 20, 19, 18, 18, 17, 17, 16, 16, 15, 15];
    baseRains = [0, 0, 1.5, 4.0, 12.0, 28.5, 46.0, 38.0, 22.0, 14.5, 6.0, 1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  } else if (scenario === 'cold_wave') {
    baseTemps = [21, 20, 19, 17, 15, 12, 9, 6, 4, 2, 1, 0, -1, -2, -3, -4, -4, -4, -3, -3, -2, -2, -1, -1];
    baseRains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  } else if (scenario === 'normal') {
    // 평년 기온/강수 패턴 동적 반영
    const avg = normal.avgTemp;
    baseTemps = [
      avg - 3, avg - 4, avg - 4, avg - 3, avg - 2, avg, avg + 2, avg + 4, avg + 5, avg + 6,
      avg + 6, avg + 5, avg + 4, avg + 3, avg + 2, avg + 1, avg, avg - 1, avg - 2, avg - 2,
      avg - 3, avg - 3, avg - 3, avg - 3
    ].map(t => parseFloat(t.toFixed(1)));
    baseRains = new Array(24).fill(0);
  } else {
    // composite
    baseTemps = [17, 16, 15, 15, 14, 15, 17, 20, 22, 24, 23, 21, 17, 12, 9, 7, 5, 4, 3, 3, 2, 2, 1, 1];
    baseRains = [0, 0, 0, 0, 0, 0, 0, 2.0, 6.5, 14.0, 22.5, 34.0, 19.0, 7.5, 2.0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  const dayMaxTemp = Math.max(...baseTemps);
  let prevTemp: number | null = null;

  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getTime() + i * 3600000);
    const hourStr = `${String(d.getHours()).padStart(2, '0')}:00`;
    const fullDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hourStr}`;

    const temp = baseTemps[i % baseTemps.length];
    const rain = baseRains[i % baseRains.length];
    const pop = rain >= 30 ? 95 : rain > 0 ? 80 : 10;
    const sky = rain > 0 ? '흐림' : temp < 5 ? '맑음' : '구름많음';
    const pty = rain >= 30 ? '비(극한호우)' : rain > 0 ? '비' : '없음';

    const { isExtreme, alertLevel, reasons } = evaluateSeasonalExtremeCondition(
      temp,
      rain,
      prevTemp,
      dayMaxTemp,
      normal
    );
    prevTemp = temp;

    result.push({
      time: hourStr,
      fullDate,
      temp,
      rain,
      pop,
      pty,
      sky,
      isExtreme,
      alertLevel,
      extremeReasons: reasons,
    });
  }

  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scenarioParam = searchParams.get('scenario');
  const isRealtime = !scenarioParam || scenarioParam === 'realtime';
  const scenario = (isRealtime ? 'realtime' : scenarioParam) as ScenarioType;
  const isForceMock = searchParams.get('forceMock') === 'true' || (!isRealtime && searchParams.has('scenario'));

  const serviceKey = process.env.KMA_SERVICE_KEY || process.env.WEATHER_API_KEY;
  const { baseDate, baseTime, month } = getLatestBaseTime(new Date());
  const monthlyNormal = MONTHLY_CLIMATE_NORMALS[month] || MONTHLY_CLIMATE_NORMALS[11];

  // 시나리오가 지정되었거나 서비스키가 없을 때 모의 시나리오 데이터 반환
  if (!serviceKey || isForceMock) {
    const mockHourly = generateMockByScenario(isRealtime ? 'composite' : scenario, month);
    const temps = mockHourly.map(h => h.temp);
    const rains = mockHourly.map(h => h.rain);
    const extremeList = mockHourly.filter(h => h.isExtreme);

    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const maxRain = Math.max(...rains);
    const tempDropMax = maxTemp - minTemp;
    const totalRain = parseFloat(rains.reduce((a, b) => a + b, 0).toFixed(1));

    let elninoAlertLevel: AlertLevel = '정상';
    if (mockHourly.some(h => h.alertLevel === '심각')) elninoAlertLevel = '심각';
    else if (mockHourly.some(h => h.alertLevel === '경고')) elninoAlertLevel = '경고';
    else if (mockHourly.some(h => h.alertLevel === '주의')) elninoAlertLevel = '주의';

    const hasHeavyRain = maxRain >= Math.max(monthlyNormal.maxRainHourly * 2, 15);
    const hasColdWave = tempDropMax >= 10 && minTemp <= 3;
    const hasHeatWave = maxTemp >= 33;
    const alerts = Array.from(new Set(extremeList.flatMap(h => h.extremeReasons)));

    return NextResponse.json<WeatherResponse>({
      success: true,
      scenario,
      location: { city: '경기도 고양시', nx: GOYANG_NX, ny: GOYANG_NY },
      baseDateTime: `${baseDate} ${baseTime}`,
      currentMonth: month,
      monthlyNormal,
      isMock: true,
      message: `${month}월 [${monthlyNormal.season}] 기상청 30년 평년값 적용 시뮬레이션 (${scenario})`,
      hourly: mockHourly,
      summary: {
        currentTemp: mockHourly[0]?.temp ?? 0,
        maxTemp,
        minTemp,
        tempDropMax24h: parseFloat(tempDropMax.toFixed(1)),
        maxRain,
        totalRain,
        elninoAlertLevel,
        hasExtremeWeather: extremeList.length > 0,
        hasHeavyRain,
        hasColdWave,
        hasHeatWave,
        extremeCount: extremeList.length,
        extremeAlerts: alerts,
      },
      regions: generateRegionalRisk(
        mockHourly[0]?.temp ?? 15,
        minTemp,
        maxRain,
        tempDropMax,
        elninoAlertLevel
      ),
    });
  }

  try {
    const url = new URL('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('dataType', 'JSON');
    url.searchParams.set('base_date', baseDate);
    url.searchParams.set('base_time', baseTime);
    url.searchParams.set('nx', GOYANG_NX.toString());
    url.searchParams.set('ny', GOYANG_NY.toString());

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`기상청 API 응답 오류: ${res.status}`);

    const data = await res.json();
    const header = data?.response?.header;
    if (header?.resultCode !== '00') {
      throw new Error(`기상청 API 결과 코드 에러: ${header?.resultMsg || header?.resultCode}`);
    }

    const items = data?.response?.body?.items?.item || [];

    interface RawSlot {
      TMP?: number;
      PCP?: number;
      POP?: number;
      SKY?: string;
      PTY?: string;
    }
    const slotMap = new Map<string, RawSlot>();

    for (const item of items) {
      const key = `${item.fcstDate}_${item.fcstTime}`;
      if (!slotMap.has(key)) slotMap.set(key, {});
      const slot = slotMap.get(key)!;

      if (item.category === 'TMP' || item.category === 'T1H') slot.TMP = parseFloat(item.fcstValue);
      if (item.category === 'PCP' || item.category === 'RN1') slot.PCP = parsePrecipitation(item.fcstValue);
      if (item.category === 'POP') slot.POP = parseFloat(item.fcstValue);
      if (item.category === 'SKY') slot.SKY = parseSky(item.fcstValue);
      if (item.category === 'PTY') slot.PTY = parsePty(item.fcstValue);
    }

    const sortedKeys = Array.from(slotMap.keys()).sort();
    const hourlyTempsOnly = sortedKeys.slice(0, 24).map(k => slotMap.get(k)?.TMP ?? 0);
    const dayMaxTemp = hourlyTempsOnly.length ? Math.max(...hourlyTempsOnly) : 20;

    const hourly: HourlyWeather[] = [];
    let prevTemp: number | null = null;

    for (const key of sortedKeys.slice(0, 24)) {
      const [datePart, timePart] = key.split('_');
      const hourStr = `${timePart.slice(0, 2)}:00`;
      const fullDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)} ${hourStr}`;
      const slot = slotMap.get(key)!;

      const temp = slot.TMP ?? 0;
      const rain = slot.PCP ?? 0;
      const pop = slot.POP ?? 0;
      const sky = slot.SKY ?? '맑음';
      const pty = slot.PTY ?? '없음';

      const { isExtreme, alertLevel, reasons } = evaluateSeasonalExtremeCondition(
        temp,
        rain,
        prevTemp,
        dayMaxTemp,
        monthlyNormal
      );
      prevTemp = temp;

      hourly.push({
        time: hourStr,
        fullDate,
        temp,
        rain,
        pop,
        sky,
        pty,
        isExtreme,
        alertLevel,
        extremeReasons: reasons,
      });
    }

    const temps = hourly.map(h => h.temp);
    const rains = hourly.map(h => h.rain);
    const extremeList = hourly.filter(h => h.isExtreme);

    const maxTemp = temps.length ? Math.max(...temps) : 0;
    const minTemp = temps.length ? Math.min(...temps) : 0;
    const maxRain = rains.length ? Math.max(...rains) : 0;
    const tempDropMax = maxTemp - minTemp;
    const totalRain = rains.length ? parseFloat(rains.reduce((a, b) => a + b, 0).toFixed(1)) : 0;

    let elninoAlertLevel: AlertLevel = '정상';
    if (hourly.some(h => h.alertLevel === '심각')) elninoAlertLevel = '심각';
    else if (hourly.some(h => h.alertLevel === '경고')) elninoAlertLevel = '경고';
    else if (hourly.some(h => h.alertLevel === '주의')) elninoAlertLevel = '주의';

    const hasHeavyRain = maxRain >= Math.max(monthlyNormal.maxRainHourly * 2, 15);
    const hasColdWave = tempDropMax >= 10 && minTemp <= 3;
    const hasHeatWave = maxTemp >= 33;
    const alerts = Array.from(new Set(extremeList.flatMap(h => h.extremeReasons)));

    return NextResponse.json<WeatherResponse>({
      success: true,
      scenario: 'realtime',
      location: { city: '경기도 고양시', nx: GOYANG_NX, ny: GOYANG_NY },
      baseDateTime: `${baseDate} ${baseTime}`,
      currentMonth: month,
      monthlyNormal,
      isMock: false,
      hourly,
      summary: {
        currentTemp: hourly[0]?.temp ?? 0,
        maxTemp,
        minTemp,
        tempDropMax24h: parseFloat(tempDropMax.toFixed(1)),
        maxRain,
        totalRain,
        elninoAlertLevel,
        hasExtremeWeather: extremeList.length > 0,
        hasHeavyRain,
        hasColdWave,
        hasHeatWave,
        extremeCount: extremeList.length,
        extremeAlerts: alerts,
      },
      regions: generateRegionalRisk(
        hourly[0]?.temp ?? 15,
        minTemp,
        maxRain,
        tempDropMax,
        elninoAlertLevel
      ),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Weather API fallback:', errorMsg);

    const mockHourly = generateMockByScenario('composite', month);
    const temps = mockHourly.map(h => h.temp);
    const rains = mockHourly.map(h => h.rain);
    const extremeList = mockHourly.filter(h => h.isExtreme);

    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const maxRain = Math.max(...rains);
    const tempDropMax = maxTemp - minTemp;
    const totalRain = parseFloat(rains.reduce((a, b) => a + b, 0).toFixed(1));

    let elninoAlertLevel: AlertLevel = '정상';
    if (mockHourly.some(h => h.alertLevel === '심각')) elninoAlertLevel = '심각';
    else if (mockHourly.some(h => h.alertLevel === '경고')) elninoAlertLevel = '경고';
    else if (mockHourly.some(h => h.alertLevel === '주의')) elninoAlertLevel = '주의';

    const hasHeavyRain = maxRain >= Math.max(monthlyNormal.maxRainHourly * 2, 15);
    const hasColdWave = tempDropMax >= 10 && minTemp <= 3;
    const hasHeatWave = maxTemp >= 33;
    const alerts = Array.from(new Set(extremeList.flatMap(h => h.extremeReasons)));

    return NextResponse.json<WeatherResponse>({
      success: true,
      scenario: 'realtime',
      location: { city: '경기도 고양시', nx: GOYANG_NX, ny: GOYANG_NY },
      baseDateTime: `${baseDate} ${baseTime}`,
      currentMonth: month,
      monthlyNormal,
      isMock: true,
      message: `기상청 API 장애(${errorMsg})로 모의 시나리오 데이터로 대체되었습니다.`,
      hourly: mockHourly,
      summary: {
        currentTemp: mockHourly[0]?.temp ?? 0,
        maxTemp,
        minTemp,
        tempDropMax24h: parseFloat(tempDropMax.toFixed(1)),
        maxRain,
        totalRain,
        elninoAlertLevel,
        hasExtremeWeather: extremeList.length > 0,
        hasHeavyRain,
        hasColdWave,
        hasHeatWave,
        extremeCount: extremeList.length,
        extremeAlerts: alerts,
      },
      regions: generateRegionalRisk(
        mockHourly[0]?.temp ?? 15,
        minTemp,
        maxRain,
        tempDropMax,
        elninoAlertLevel
      ),
    });
  }
}
