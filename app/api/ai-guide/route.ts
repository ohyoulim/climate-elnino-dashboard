import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function getEffectiveApiKey(): string {
  // 1. .env.local 파일에서 직접 파싱 (시스템 전역 환경변수의 낡은 키보다 우선)
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
  } catch {
    // ignore
  }
  return (process.env.GEMINI_API_KEY || '').trim();
}

export interface WeatherContext {
  city?: string;
  maxTemp: number;
  minTemp: number;
  maxRain: number;
  totalRain: number;
  hasExtremeWeather: boolean;
  extremeAlerts?: string[];
  hourlySummary?: Array<{
    time: string;
    temp: number;
    rain: number;
    isExtreme: boolean;
    extremeReasons: string[];
  }>;
}

export interface AiGuideResponse {
  success: boolean;
  citizenGuide: string[];
  farmerGuide: string[];
  riskLevel: '주의' | '경고' | '심각' | '보통';
  analysis: string;
  isMock: boolean;
  modelUsed?: string;
  error?: string;
}

const DEFAULT_WEATHER_CONTEXT: WeatherContext = {
  city: '경기도 고양시',
  maxTemp: 15,
  minTemp: 5,
  maxRain: 0,
  totalRain: 0,
  hasExtremeWeather: false,
  extremeAlerts: [],
};

function generateFallbackGuide(context: WeatherContext): Omit<AiGuideResponse, 'success' | 'isMock'> {
  const isHeavyRain = context.maxRain >= 15;
  const tempDrop = parseFloat((context.maxTemp - context.minTemp).toFixed(1));
  const isColdWave = tempDrop >= 10 && context.minTemp <= 5;
  const hasExtreme = context.hasExtremeWeather || isHeavyRain || isColdWave;

  if (hasExtreme) {
    // 1. 복합 재난 (폭우 + 기온급락)
    if (isHeavyRain && isColdWave) {
      return {
        riskLevel: '심각',
        analysis: `슈퍼 엘니뇨 복합 재난 감지: 국지성 폭우(최대 ${context.maxRain}mm/h)와 급격한 기온 폭락(-${tempDrop}℃)이 동시 관측되어 복합 침수 및 동해 방재가 시급합니다.`,
        citizenGuide: [
          '1. 반지하 주택 및 저지대 지하차도 진입을 절대 금지하고 배수 상태를 점검하세요.',
          '2. 급격한 한기 유입에 대비해 방한 외투를 준비하고 야외 활동을 최소화하세요.',
          '3. 하천변 산책로와 노후 축대 통행을 즉시 중단하고 긴급 재난문자에 귀 기울이세요.',
        ],
        farmerGuide: [
          '1. 시설 하우스 배수로를 긴급 정비하고 역류 방지 밸브를 즉시 가동하세요.',
          '2. 급격한 기온 강하에 대비해 보온 커튼과 온풍 난방기를 즉각 점검 및 가동하세요.',
          '3. 농경지 침수 우려 구역에 양수기를 사전 전진 배치하고 비상 대기하세요.',
        ],
      };
    }

    // 2. 극한 호우 단독
    if (isHeavyRain) {
      return {
        riskLevel: context.maxRain >= 30 ? '심각' : '경고',
        analysis: `슈퍼 엘니뇨 극한 호우 감지: 시간당 최대 ${context.maxRain}mm(총 누적 ${context.totalRain}mm)의 강한 비로 인해 도심 및 농경지 침수 위험이 높습니다.`,
        citizenGuide: [
          '1. 침수 우려 도로, 지하차도 및 하천변 보행로 출입을 즉시 중단하세요.',
          '2. 맨홀 뚜껑 이탈 및 역류 위험에 유의하고 빗물받이 덮개를 신속히 제거하세요.',
          '3. 상습 침수 구역 주민은 사전에 지정된 고지대 안전 대피소로 이동하세요.',
        ],
        farmerGuide: [
          '1. 비닐하우스 주변 배수로 물길을 깊게 트고 농경지 침수 피해를 예방하세요.',
          '2. 강풍을 동반한 호우에 대비해 하우스 비닐 고정끈을 견고히 보강 결속하세요.',
          '3. 벼 및 밭작물 침수 시 신속한 퇴수 작업을 위해 배수 펌프를 점검하세요.',
        ],
      };
    }

    // 3. 기습 한파 단독
    if (isColdWave) {
      return {
        riskLevel: tempDrop >= 15 ? '심각' : '경고',
        analysis: `제트기류 약화 기습 한파 감지: 24시간 내 기온이 -${tempDrop}℃ 급락(최저 ${context.minTemp}℃)하여 시설물 동파 및 한파 피해가 우려됩니다.`,
        citizenGuide: [
          '1. 외출 시 목도리, 장갑 등 방한용품을 반드시 착용하고 체온 유지에 유의하세요.',
          '2. 야외 수도계량기 및 보일러 배관에 헌 옷 등 보온재를 채워 동파를 예방하세요.',
          '3. 한랭질환(저체온증, 동상) 고위험군인 노약자는 장시간 야외 활동을 자제하세요.',
        ],
        farmerGuide: [
          '1. 시설 원예 비닐하우스 보온 다겹커튼을 닫고 가온 시설을 즉각 가동하세요.',
          '2. 저온 피해에 취약한 과수 및 시설 채소의 생육 적정 온도를 상시 모니터링하세요.',
          '3. 축사 환기창을 닫고 찬 바람 유입을 차단하며 가축 방한 보온재를 점검하세요.',
        ],
      };
    }

    // 4. 기타 주의 단계
    return {
      riskLevel: '주의',
      analysis: `기상 변동성 확대: 현재 기온 ${context.minTemp}℃~${context.maxTemp}℃ 범위에서 국지적 기상 변화가 관측되어 주의가 필요합니다.`,
      citizenGuide: [
        '1. 급변하는 환절기 기온에 대비해 방한 겉옷을 준비하세요.',
        '2. 외출 전 실시간 기상 특보와 미세먼지 수치를 확인하세요.',
        '3. 빗길이나 쌀쌀한 날씨에 따른 안전사고에 유의하세요.',
      ],
      farmerGuide: [
        '1. 농작물 생육 환경 온습도를 수시로 점검하세요.',
        '2. 시설 하우스 환기 관리 및 급격한 온도 변화에 대비하세요.',
        '3. 주변 배수로 및 방재 자재를 사전 정비하세요.',
      ],
    };
  }

  // 5. 정상 단계 (평년 수준)
  return {
    riskLevel: '보통',
    analysis: `현재 고양시 기온(${context.minTemp}℃~${context.maxTemp}℃)과 강수량(${context.totalRain}mm)은 평년 범위 내에서 안정적으로 유지되고 있습니다.`,
    citizenGuide: [
      '1. 환절기 일교차에 대비해 얇은 옷을 여러 겹 착용하고 건강을 관리하세요.',
      '2. 외출 전 실시간 단기예보를 확인하여 쾌적한 일상 활동을 이어가세요.',
      '3. 실내 적정 온습도를 유지하여 호흡기 질환을 사전에 예방하세요.',
    ],
    farmerGuide: [
      '1. 시설 하우스 주야간 적정 온도 유지 및 원활한 주간 환기 작업을 진행하세요.',
      '2. 작물별 생육 단계에 맞춰 적정 수분 공급과 관수 관리를 실시하세요.',
      '3. 병충해 발생 여부를 정기 예찰하고 사전 방제 작업을 점검하세요.',
    ],
  };
}

export async function POST(req: NextRequest) {
  let weatherContext: WeatherContext = DEFAULT_WEATHER_CONTEXT;

  try {
    const raw = await req.json();
    if (raw && typeof raw === 'object') {
      weatherContext = { ...DEFAULT_WEATHER_CONTEXT, ...raw };
    }

    const apiKey = getEffectiveApiKey();
    console.log(`[AI Guide] Using effective apiKey: ${apiKey.substring(0, 10)}... (length: ${apiKey.length})`);

    if (!apiKey) {
      const fallback = generateFallbackGuide(weatherContext);
      return NextResponse.json<AiGuideResponse>({
        success: true,
        ...fallback,
        isMock: true,
        analysis: `${fallback.analysis} (GEMINI_API_KEY 미설정으로 사전 정의된 엘니뇨 대응 매뉴얼이 제공됩니다.)`,
      });
    }

    // Google 최신 공식 SDK 인스턴스 생성
    const ai = new GoogleGenAI({ apiKey });

    const extremeAlertsText = weatherContext.extremeAlerts && weatherContext.extremeAlerts.length > 0
      ? weatherContext.extremeAlerts.join(', ')
      : weatherContext.hasExtremeWeather ? '이상기후 주의보 감지' : '특이 이상기후 없음';

    const prompt = `
당신은 슈퍼 엘니뇨 이상기후 방재 전문 AI 컨설턴트입니다.
현재 기상청 예보 데이터(고양시 기준)는 다음과 같습니다:
- 최고 기온: ${weatherContext.maxTemp}℃, 최저 기온: ${weatherContext.minTemp}℃
- 최대 1시간 강수량: ${weatherContext.maxRain}mm, 총 누적 강수량: ${weatherContext.totalRain}mm
- 이상기후 감지 여부: ${weatherContext.hasExtremeWeather ? '경보 감지됨' : '정상 범위'}
- 이상기후 세부사항: ${extremeAlertsText}

위 기상 상황(특히 강수 15mm/30mm 이상 극한 폭우 또는 제트기류 약화 기온 급격 하강 등 엘니뇨 영향)을 종합 분석하여, 
반드시 아래 JSON 형식으로만 한국어로 정확히 답변해주세요:

{
  "riskLevel": "주의" | "경고" | "심각" | "보통",
  "analysis": "기상 상황과 엘니뇨 위험도에 대한 1~2문장 핵심 요약",
  "citizenGuide": [
    "1. [시민 행동 요령 첫 번째 문장]",
    "2. [시민 행동 요령 두 번째 문장]",
    "3. [시민 행동 요령 세 번째 문장]"
  ],
  "farmerGuide": [
    "1. [농가 맞춤 행동 요령 첫 번째 문장]",
    "2. [농가 맞춤 행동 요령 두 번째 문장]",
    "3. [농가 맞춤 행동 요령 세 번째 문장]"
  ]
}

주의사항:
- 시민 맞춤 행동 요령은 정확히 3줄(3문장) 요약이어야 합니다.
- 농가 맞춤 행동 요령도 정확히 3줄(3문장) 요약이어야 합니다.
- 마크다운 코드블록없이 순수 JSON 텍스트만 출력하세요.
`;

    // 최신 Google AI Studio 모델 우선순위 순차 호출 (gemini-3.5-flash-lite -> gemini-3.8-flash -> gemini-2.5-flash)
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastError: unknown = null;
    let responseText = '';
    let successModel = '';

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        if (response.text) {
          responseText = response.text.trim();
          successModel = model;
          break;
        }
      } catch (e) {
        lastError = e;
        console.warn(`Model ${model} failed, trying next candidate:`, e instanceof Error ? e.message : e);
      }
    }

    if (!responseText) {
      throw lastError || new Error('모든 Gemini 모델 응답 생성에 실패했습니다.');
    }

    const cleanedJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanedJson);

    return NextResponse.json<AiGuideResponse>({
      success: true,
      riskLevel: parsed.riskLevel || (weatherContext.hasExtremeWeather ? '경고' : '보통'),
      analysis: parsed.analysis || '슈퍼 엘니뇨 기후 모니터링 분석 완료',
      citizenGuide: Array.isArray(parsed.citizenGuide) && parsed.citizenGuide.length === 3 
        ? parsed.citizenGuide 
        : generateFallbackGuide(weatherContext).citizenGuide,
      farmerGuide: Array.isArray(parsed.farmerGuide) && parsed.farmerGuide.length === 3 
        ? parsed.farmerGuide 
        : generateFallbackGuide(weatherContext).farmerGuide,
      isMock: false,
      modelUsed: successModel,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Gemini AI API Error:', errorMsg);

    const fallback = generateFallbackGuide(weatherContext);

    return NextResponse.json<AiGuideResponse>({
      success: true,
      ...fallback,
      isMock: true,
      error: errorMsg,
      analysis: `${fallback.analysis} (안전 방재 매뉴얼로 자동 전환되었습니다.)`,
    });
  }
}
