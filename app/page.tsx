'use client';

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js';
import 'chart.js/auto';
import { Chart } from 'react-chartjs-2';
import {
  AlertTriangle,
  CloudRain,
  Thermometer,
  ShieldAlert,
  Users,
  Tractor,
  RefreshCw,
  Sparkles,
  Calendar,
  CheckCircle2,
  TrendingDown,
  MapPin,
  Flame,
  Snowflake,
  Compass,
  Radio,
  Sliders,
  Layers,
  Activity,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
  Filler
);

type AlertLevel = '정상' | '주의' | '경고' | '심각';
type ScenarioType = 'realtime' | 'composite' | 'heavy_rain' | 'cold_wave' | 'normal';

interface HourlyItem {
  time: string;
  fullDate: string;
  temp: number;
  rain: number;
  pop: number;
  pty: string;
  sky: string;
  isExtreme: boolean;
  alertLevel: AlertLevel;
  extremeReasons: string[];
}

interface RegionRisk {
  name: string;
  code: string;
  rain: number;
  temp: number;
  alertLevel: AlertLevel;
  riskDescription: string;
  isFloodingRisk: boolean;
  isColdWaveRisk: boolean;
}

interface MonthlyClimateInfo {
  month: number;
  season: '봄' | '여름' | '가을' | '겨울';
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  maxRainHourly: number;
  primaryRisk: string;
}

interface WeatherData {
  success: boolean;
  scenario: ScenarioType;
  location: { city: string; nx: number; ny: number };
  baseDateTime: string;
  currentMonth: number;
  monthlyNormal: MonthlyClimateInfo;
  isMock: boolean;
  message?: string;
  hourly: HourlyItem[];
  summary: {
    currentTemp: number;
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

interface AiGuideData {
  success: boolean;
  citizenGuide: string[];
  farmerGuide: string[];
  riskLevel: '주의' | '경고' | '심각' | '보통';
  analysis: string;
  isMock: boolean;
  modelUsed?: string;
  error?: string;
}

export default function Home() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [aiGuide, setAiGuide] = useState<AiGuideData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('GOYANG_ILSAN_DONG');
  const [scenario, setScenario] = useState<ScenarioType>('realtime');

  // 비동기 요청 순서 꼬임(Race Condition) 방지용 요청 ID 카운터
  const lastRequestIdRef = React.useRef(0);

  const fetchWeather = async (targetScenario: ScenarioType = scenario) => {
    const currentRequestId = ++lastRequestIdRef.current;
    try {
      setLoadingWeather(true);
      setError(null);
      // 시나리오가 바뀌면 이전 AI 요령을 즉시 초기화하여 이전 시나리오 수치 노출 방지
      setAiGuide(null);
      setLoadingAi(true);

      const url = targetScenario === 'realtime'
        ? '/api/weather?scenario=realtime'
        : `/api/weather?scenario=${targetScenario}`;

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('기상 데이터를 불러오지 못했습니다.');
      const data: WeatherData = await res.json();
      
      // 최신 요청인 경우에만 상태 업데이트
      if (currentRequestId === lastRequestIdRef.current) {
        setWeather(data);
        fetchAiGuide(data, currentRequestId);
      }
    } catch (err: unknown) {
      if (currentRequestId === lastRequestIdRef.current) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setLoadingAi(false);
      }
    } finally {
      if (currentRequestId === lastRequestIdRef.current) {
        setLoadingWeather(false);
      }
    }
  };

  const handleRefreshRealtime = () => {
    setScenario('realtime');
    fetchWeather('realtime');
  };

  const handleScenarioChange = (newScenario: ScenarioType) => {
    setScenario(newScenario);
    fetchWeather(newScenario);
  };

  const fetchAiGuide = async (currentWeather: WeatherData, requestId: number) => {
    try {
      setLoadingAi(true);
      const res = await fetch('/api/ai-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          city: currentWeather.location.city,
          maxTemp: currentWeather.summary.maxTemp,
          minTemp: currentWeather.summary.minTemp,
          maxRain: currentWeather.summary.maxRain,
          totalRain: currentWeather.summary.totalRain,
          hasExtremeWeather: currentWeather.summary.hasExtremeWeather,
          extremeAlerts: currentWeather.summary.extremeAlerts,
          hourlySummary: currentWeather.hourly.slice(0, 12),
        }),
      });
      if (!res.ok) throw new Error('AI 가이드 생성에 실패했습니다.');
      const aiData: AiGuideData = await res.json();
      // 가장 최근 요청의 응답만 세팅
      if (requestId === lastRequestIdRef.current) {
        setAiGuide(aiData);
      }
    } catch (err: unknown) {
      console.error('fetchAiGuide error:', err);
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setLoadingAi(false);
      }
    }
  };

  useEffect(() => {
    fetchWeather('realtime');
  }, []);

  const chartLabels = weather?.hourly.map(h => h.time) || [];
  const tempData = weather?.hourly.map(h => h.temp) || [];
  const rainData = weather?.hourly.map(h => h.rain) || [];

  const getRegionSvgColor = (code: string) => {
    const reg = weather?.regions.find(r => r.code === code);
    const isSelected = selectedRegion === code;
    const level = reg?.alertLevel || '정상';

    if (isSelected) {
      switch (level) {
        case '심각': return { fill: 'rgba(239, 68, 68, 0.55)', stroke: '#ef4444' };
        case '경고': return { fill: 'rgba(249, 115, 22, 0.55)', stroke: '#f97316' };
        case '주의': return { fill: 'rgba(245, 158, 11, 0.55)', stroke: '#f59e0b' };
        default: return { fill: 'rgba(16, 185, 129, 0.5)', stroke: '#10b981' };
      }
    }
    switch (level) {
      case '심각': return { fill: 'rgba(239, 68, 68, 0.22)', stroke: 'rgba(239, 68, 68, 0.55)' };
      case '경고': return { fill: 'rgba(249, 115, 22, 0.22)', stroke: 'rgba(249, 115, 22, 0.55)' };
      case '주의': return { fill: 'rgba(245, 158, 11, 0.22)', stroke: 'rgba(245, 158, 11, 0.55)' };
      default: return { fill: 'rgba(16, 185, 129, 0.18)', stroke: 'rgba(16, 185, 129, 0.45)' };
    }
  };

  const rainBarColors = weather?.hourly.map(h =>
    h.rain >= 30
      ? 'rgba(239, 68, 68, 0.9)'
      : h.rain >= 15
      ? 'rgba(249, 115, 22, 0.85)'
      : 'rgba(59, 130, 246, 0.7)'
  ) || [];

  const chartData: ChartData<'bar' | 'line'> = {
    labels: chartLabels,
    datasets: [
      {
        type: 'line' as const,
        label: '기온 (T1H/TMP, ℃)',
        data: tempData,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.08)',
        yAxisID: 'yTemp',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: weather?.hourly.map(h =>
          h.alertLevel === '심각' ? '#ef4444' : h.alertLevel === '경고' ? '#f97316' : '#3b82f6'
        ) || '#f97316',
        pointRadius: weather?.hourly.map(h => (h.isExtreme ? 6 : 4)) || 4,
        pointHoverRadius: 8,
      },
      {
        type: 'bar' as const,
        label: '1시간 강수량 (RN1/PCP, mm)',
        data: rainData,
        backgroundColor: rainBarColors,
        yAxisID: 'yRain',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          font: { family: 'sans-serif', size: 11, weight: 'bold' },
        },
      },
      tooltip: {
        callbacks: {
          afterTitle: function (context) {
            const index = context[0].dataIndex;
            const item = weather?.hourly[index];
            if (item?.isExtreme && item.extremeReasons.length > 0) {
              return `⚠️ [${item.alertLevel}] ${item.extremeReasons.join(' / ')}`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { font: { size: 10 }, color: '#94a3b8' },
      },
      yTemp: {
        type: 'linear' as const,
        position: 'left' as const,
        title: {
          display: true,
          text: '기온 (℃)',
          color: '#f97316',
          font: { weight: 'bold', size: 11 },
        },
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { color: '#f97316', font: { size: 10 } },
      },
      yRain: {
        type: 'linear' as const,
        position: 'right' as const,
        title: {
          display: true,
          text: '강수량 (mm)',
          color: '#3b82f6',
          font: { weight: 'bold', size: 11 },
        },
        min: 0,
        suggestedMax: 40,
        grid: { drawOnChartArea: false },
        ticks: { color: '#3b82f6', font: { size: 10 } },
      },
    },
  };

  const elninoLevel = weather?.summary.elninoAlertLevel || '정상';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-orange-500 selection:text-white">
      {/* 최상단 공통 헤더 (반응형 최적화) */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-500 rounded-xl shadow-lg shadow-orange-500/20 text-white shrink-0">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-white truncate">
                  슈퍼 엘니뇨 극한 강수 & 기습 한파 실시간 조기경보
                </h1>
                <span className="shrink-0 px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 whitespace-nowrap">
                  고양·수도권 관제
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate hidden sm:block">
                기상청 단기예보 파이프라인(T1H·RN1·SKY) & 기후 평년값 대비 이상기후 실시간 감지
              </p>
            </div>
          </div>

          {/* 헤더 우측 버튼 그룹 */}
          <div className="flex items-center space-x-2 shrink-0">
            {scenario === 'realtime' ? (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] sm:text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1.5" />
                기상청 LIVE
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] sm:text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                모의 모드
              </span>
            )}

            <button
              onClick={handleRefreshRealtime}
              disabled={loadingWeather}
              title="현재 고양시의 실제 기상청 관측 상태로 새로고침합니다"
              className="inline-flex items-center px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingWeather ? 'animate-spin' : ''}`} />
              실시간 현재 상태 갱신
            </button>
          </div>
        </div>
      </header>

      {/* 비상 특보 알림 배너 */}
      {weather?.summary.hasExtremeWeather && (
        <div className="bg-gradient-to-r from-red-950/80 via-rose-900/50 to-slate-900 border-b border-red-500/40 px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 text-red-200 min-w-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-red-400 animate-bounce" />
              <div className="text-xs sm:text-sm font-medium truncate">
                <span className="font-bold text-red-100">[슈퍼 엘니뇨 극한기상 조기경보]</span>{' '}
                {weather.summary.extremeAlerts.slice(0, 2).join(' ｜ ')}
              </div>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0 text-[11px] sm:text-xs">
              {weather.summary.hasHeavyRain && (
                <span className="px-2 py-0.5 rounded bg-blue-600/80 text-white font-bold flex items-center whitespace-nowrap">
                  <CloudRain className="w-3 h-3 mr-1" /> 극한 강수
                </span>
              )}
              {weather.summary.hasColdWave && (
                <span className="px-2 py-0.5 rounded bg-cyan-600/80 text-white font-bold flex items-center whitespace-nowrap">
                  <Snowflake className="w-3 h-3 mr-1" /> 기습 한파
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 대시보드 본체: 좌측 사이드바 + 우측 메인 영역 */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col lg:flex-row gap-5 sm:gap-6">
        {/* ===================== 좌측 사이드바 컨트롤 패널 ===================== */}
        <aside className="w-full lg:w-72 shrink-0 space-y-4 sm:space-y-5">
          {/* 1. 관제 모드 및 시나리오 선택 위젯 */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center space-x-2 font-bold text-sm text-white">
                <Sliders className="w-4 h-4 text-orange-400" />
                <span>관제 시나리오 제어</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Control</span>
            </div>

            {/* 실시간 기상청 복귀 버튼 */}
            <button
              onClick={handleRefreshRealtime}
              className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                scenario === 'realtime'
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500 font-bold'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <Radio className={`w-4 h-4 shrink-0 ${scenario === 'realtime' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="text-xs truncate">기상청 실시간 현재 상태</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold whitespace-nowrap shrink-0">
                LIVE
              </span>
            </button>

            {/* 모의 시나리오 선택 버튼 목록 */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                <Layers className="w-3 h-3 mr-1 text-slate-500" />
                모의 방재 시뮬레이터
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                {/* 복합 재난 */}
                <button
                  onClick={() => handleScenarioChange('composite')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    scenario === 'composite'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200 ring-1 ring-rose-500 font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs w-full">
                    <span className="truncate">⚡ 복합 재난</span>
                    <span className="text-[10px] text-rose-400 font-bold shrink-0 ml-1">심각</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 truncate hidden sm:block">낮 34mm 폭우+밤 한파</span>
                </button>

                {/* 극한 폭우 */}
                <button
                  onClick={() => handleScenarioChange('heavy_rain')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    scenario === 'heavy_rain'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-200 ring-1 ring-blue-500 font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs w-full">
                    <span className="truncate">🌧️ 극한 호우</span>
                    <span className="text-[10px] text-blue-400 font-bold shrink-0 ml-1">경고</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 truncate hidden sm:block">시간당 46mm 집중호우</span>
                </button>

                {/* 기습 한파 */}
                <button
                  onClick={() => handleScenarioChange('cold_wave')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    scenario === 'cold_wave'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500 font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs w-full">
                    <span className="truncate">❄️ 기습 한파</span>
                    <span className="text-[10px] text-cyan-400 font-bold shrink-0 ml-1">심각</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 truncate hidden sm:block">하루 만에 -25℃ 폭락</span>
                </button>

                {/* 평년 정상 */}
                <button
                  onClick={() => handleScenarioChange('normal')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    scenario === 'normal'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500 font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs w-full">
                    <span className="truncate">☀️ 평년 정상</span>
                    <span className="text-[10px] text-emerald-400 font-bold shrink-0 ml-1">정상</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 truncate hidden sm:block">평년 쾌청 날씨 (위험 0)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. 기후 평년 통계 기준 정보 카드 */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-white">
              <span className="flex items-center truncate">
                <Calendar className="w-4 h-4 mr-1 text-slate-400 shrink-0" />
                {weather?.currentMonth ?? 11}월 기후 평년값
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                1991~2020
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">평년 평균 기온:</span>
                <span className="font-semibold text-slate-200">{weather?.monthlyNormal.avgTemp}℃</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">평년 최저 기온:</span>
                <span className="font-semibold text-cyan-300">{weather?.monthlyNormal.minTemp}℃</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">평년 1시간 강우량:</span>
                <span className="font-semibold text-blue-300">{weather?.monthlyNormal.maxRainHourly} mm/h</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 break-keep">
                주요 위험: <span className="text-orange-300">{weather?.monthlyNormal.primaryRisk}</span>
              </div>
            </div>
          </div>

          {/* 3. 엘니뇨 경보 단계 범례 위젯 */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2 text-xs">
            <div className="font-bold text-white flex items-center">
              <Activity className="w-4 h-4 mr-1.5 text-rose-400 shrink-0" />
              특보 발효 기준 범례
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5 text-[11px] text-slate-300">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate"><strong>정상</strong>: 평년 범위</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate"><strong>주의</strong>: 15mm↑·하강</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                <span className="truncate"><strong>경고</strong>: 30mm↑·한파주의보</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="truncate"><strong>심각</strong>: 50mm↑·한파경보</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ===================== 우측 메인 대시보드 영역 ===================== */}
        <main className="flex-1 min-w-0 space-y-5 sm:space-y-6">
          {/* 엘니뇨 영향 경보 단계 3단계 게이지 위젯 */}
          <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <div className="flex items-center space-x-2 text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1 flex-wrap gap-1.5">
                  <span className="flex items-center">
                    <Flame className="w-4 h-4 text-orange-400 shrink-0 mr-1" />
                    슈퍼 엘니뇨 복합 이상기후 경보 단계 판정
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                    scenario === 'realtime'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  }`}>
                    {scenario === 'realtime' ? '🟢 기상청 실시간 LIVE' : `🧪 모의 시뮬레이터: ${
                      scenario === 'composite' ? '복합 재난' :
                      scenario === 'heavy_rain' ? '극한 호우' :
                      scenario === 'cold_wave' ? '기습 한파' : '평년 정상'
                    }`}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center flex-wrap gap-2">
                  <span>현재 엘니뇨 경보 단계:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-base sm:text-lg whitespace-nowrap ${
                      elninoLevel === '심각'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                        : elninoLevel === '경고'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                        : elninoLevel === '주의'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    }`}
                  >
                    【 {elninoLevel} 단계 】
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 break-keep">
                  적도 태평양 수온 상승(+2.4℃) 영향으로 한반도 극한 강우 및 제트기류 약화 기습 한기 실시간 감지
                </p>
              </div>

              {/* 3단계 스텝 게이지 */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 shrink-0">
                <div
                  className={`px-2 py-1.5 rounded-lg text-center transition ${
                    elninoLevel === '주의'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-400'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  <div className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">1단계 [주의]</div>
                  <div className="text-[9px] sm:text-[10px] opacity-80 whitespace-nowrap">강수15mm↑</div>
                </div>

                <div
                  className={`px-2 py-1.5 rounded-lg text-center transition ${
                    elninoLevel === '경고'
                      ? 'bg-orange-500 text-white font-black shadow-md ring-2 ring-orange-400'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  <div className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">2단계 [경고]</div>
                  <div className="text-[9px] sm:text-[10px] opacity-80 whitespace-nowrap">강수30mm↑</div>
                </div>

                <div
                  className={`px-2 py-1.5 rounded-lg text-center transition ${
                    elninoLevel === '심각'
                      ? 'bg-red-600 text-white font-black shadow-md ring-2 ring-red-400 animate-pulse'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  <div className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">3단계 [심각]</div>
                  <div className="text-[9px] sm:text-[10px] opacity-80 whitespace-nowrap">강수50mm↑</div>
                </div>
              </div>
            </div>
          </section>

          {/* 핵심 KPI 4종 지표 카드 (반응형 그리드) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>관측 격자 (고양시)</span>
                <Compass className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
              <div className="text-base sm:text-lg font-bold text-white truncate">nx: 57 / ny: 128</div>
              <div className="text-xs text-slate-400 mt-1 truncate">
                발표: {weather?.baseDateTime || '--'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>기온 급락폭 (24h)</span>
                <Thermometer className="w-4 h-4 text-cyan-400 shrink-0" />
              </div>
              <div className="text-base sm:text-lg font-bold text-cyan-400 truncate">
                {weather?.summary.tempDropMax24h ?? 0}℃ 급락
              </div>
              <div className="text-xs text-slate-400 mt-1 break-keep">
                {weather?.summary.hasColdWave ? (
                  <span className="text-red-400 font-semibold">⚠️ 한파특보 기준 충족 (최고 {weather?.summary.maxTemp}℃ ➔ 최저 {weather?.summary.minTemp}℃)</span>
                ) : (
                  <span>최고 {weather?.summary.maxTemp}℃ ➔ 최저 {weather?.summary.minTemp}℃</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>최대 1시간 강수량 (RN1)</span>
                <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
              </div>
              <div className={`text-base sm:text-lg font-bold truncate ${weather && weather.summary.maxRain >= 30 ? 'text-red-400' : weather && weather.summary.maxRain >= 15 ? 'text-orange-400' : 'text-blue-400'}`}>
                {weather?.summary.maxRain ?? 0} mm/h
              </div>
              <div className="text-xs mt-1 truncate">
                {weather && weather.summary.maxRain >= 30 ? (
                  <span className="text-red-400 font-bold">호우경보급 극한 강수</span>
                ) : weather && weather.summary.maxRain >= 15 ? (
                  <span className="text-orange-400 font-semibold">기습 폭우 주의</span>
                ) : (
                  <span className="text-slate-400">누적 {weather?.summary.totalRain || 0}mm</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>이상기후 감지 구간</span>
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
              <div className="text-base sm:text-lg font-bold text-amber-400 truncate">
                {weather?.summary.extremeCount ?? 0} 개 시간대
              </div>
              <div className="text-xs text-slate-400 mt-1 truncate">
                {weather?.summary.hasExtremeWeather ? '폭우·한파 복합 위험' : '정상 범위 유지'}
              </div>
            </div>
          </section>

          {/* 차트 & 지오테크 맵 & AI 카드 2단 그리드 */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
            {/* 좌측: 기상 시계열 차트 & 지오테크 맵 (7칸) */}
            <div className="xl:col-span-7 flex flex-col space-y-5 min-w-0">
              {/* 시간별 시계열 차트 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center">
                      <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 mr-2 shrink-0" />
                      시간별 기온(T1H) & 1시간 강수량(RN1) 시계열
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                      붉은 막대: 30mm/h 이상 호우경보급 / 주황 막대: 15mm/h 이상 주의보급
                    </p>
                  </div>
                </div>

                <div className="h-64 sm:h-72 w-full">
                  {loadingWeather ? (
                    <div className="h-full flex items-center justify-center text-xs sm:text-sm text-slate-400">
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mr-2 text-orange-400" />
                      기상청 시계열 데이터 파싱 중...
                    </div>
                  ) : (
                    <Chart type="bar" data={chartData} options={chartOptions} />
                  )}
                </div>
              </div>

              {/* 지오테크 고양·수도권 위험 구역 인터랙티브 맵 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 min-w-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      지오테크 고양·수도권 위험 구역 인터랙티브 맵
                    </h3>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap shrink-0">클릭하여 연동</span>
                </div>

                {/* SVG 벡터 공간 맵 */}
                <div className="relative mb-4 p-3 sm:p-4 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col md:flex-row items-center justify-around gap-4">
                  <div className="w-full md:w-1/2 max-w-[280px] h-[180px] shrink-0">
                    <svg viewBox="0 0 320 220" className="w-full h-full drop-shadow-xl select-none">
                      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                      </pattern>
                      <rect width="320" height="220" fill="url(#grid)" rx="10"/>

                      <path
                        d="M 10 180 Q 90 170 140 195 T 310 205"
                        fill="none"
                        stroke="#1e3a8a"
                        strokeWidth="6"
                        strokeLinecap="round"
                        className="opacity-40"
                      />
                      <text x="50" y="205" fill="#3b82f6" fontSize="10" className="font-bold opacity-60">
                        한강 수계 (수위 감시)
                      </text>

                      {/* 파주 접경 */}
                      <g
                        onClick={() => setSelectedRegion('PAJU_BORDER')}
                        className="cursor-pointer transition duration-200"
                      >
                        <polygon
                          points="20,20 140,15 130,75 30,85"
                          fill={getRegionSvgColor('PAJU_BORDER').fill}
                          stroke={getRegionSvgColor('PAJU_BORDER').stroke}
                          strokeWidth={selectedRegion === 'PAJU_BORDER' ? '2.5' : '1.5'}
                        />
                        <text x="50" y="52" fill="#bae6fd" fontSize="11" fontWeight="bold">
                          파주 접경
                        </text>
                        <text x="50" y="66" fill="#7dd3fc" fontSize="9">
                          한기 최우선 유입
                        </text>
                      </g>

                      {/* 일산서구 */}
                      <g
                        onClick={() => setSelectedRegion('GOYANG_ILSAN_SEO')}
                        className="cursor-pointer transition duration-200"
                      >
                        <polygon
                          points="35,90 125,80 120,155 25,160"
                          fill={getRegionSvgColor('GOYANG_ILSAN_SEO').fill}
                          stroke={getRegionSvgColor('GOYANG_ILSAN_SEO').stroke}
                          strokeWidth={selectedRegion === 'GOYANG_ILSAN_SEO' ? '2.5' : '1.5'}
                        />
                        <text x="45" y="120" fill="#fed7aa" fontSize="11" fontWeight="bold">
                          일산서구
                        </text>
                        <text x="45" y="134" fill="#fb923c" fontSize="9">
                          배수역류 취약
                        </text>
                      </g>

                      {/* 일산동구 */}
                      <g
                        onClick={() => setSelectedRegion('GOYANG_ILSAN_DONG')}
                        className="cursor-pointer transition duration-200"
                      >
                        <polygon
                          points="130,75 210,65 200,165 125,155"
                          fill={getRegionSvgColor('GOYANG_ILSAN_DONG').fill}
                          stroke={getRegionSvgColor('GOYANG_ILSAN_DONG').stroke}
                          strokeWidth={selectedRegion === 'GOYANG_ILSAN_DONG' ? '2.5' : '1.5'}
                        />
                        <text x="140" y="112" fill="#fecaca" fontSize="11" fontWeight="bold">
                          일산동구
                        </text>
                        <text x="140" y="126" fill="#f87171" fontSize="9">
                          도심 지하 침수
                        </text>
                      </g>

                      {/* 덕양구 */}
                      <g
                        onClick={() => setSelectedRegion('GOYANG_DEOKYANG')}
                        className="cursor-pointer transition duration-200"
                      >
                        <polygon
                          points="215,65 305,50 295,185 205,170"
                          fill={getRegionSvgColor('GOYANG_DEOKYANG').fill}
                          stroke={getRegionSvgColor('GOYANG_DEOKYANG').stroke}
                          strokeWidth={selectedRegion === 'GOYANG_DEOKYANG' ? '2.5' : '1.5'}
                        />
                        <text x="225" y="112" fill="#ffe4e6" fontSize="11" fontWeight="bold">
                          덕양구
                        </text>
                        <text x="225" y="126" fill="#fb7185" fontSize="9">
                          창릉천·비닐하우스
                        </text>
                      </g>
                    </svg>
                  </div>

                  {/* 선택된 구역 브리핑 */}
                  <div className="w-full md:w-1/2 space-y-2 text-xs min-w-0">
                    {(() => {
                      const activeReg = weather?.regions.find(r => r.code === selectedRegion) || weather?.regions[0];
                      if (!activeReg) return null;
                      return (
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="flex items-center justify-between font-bold text-white mb-1.5 flex-wrap gap-1">
                            <span className="flex items-center text-xs sm:text-sm truncate">
                              <MapPin className="w-3.5 h-3.5 mr-1 text-orange-400 shrink-0" />
                              {activeReg.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold border text-[10px] sm:text-xs whitespace-nowrap ${
                                activeReg.alertLevel === '심각'
                                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                  : activeReg.alertLevel === '경고'
                                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                                  : activeReg.alertLevel === '주의'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              {activeReg.alertLevel} 단계
                            </span>
                          </div>
                          <div className="text-slate-300 space-y-0.5 mb-2 text-[11px] sm:text-xs">
                            <div>• 기온: <strong className="text-orange-400">{activeReg.temp}℃</strong> ｜ 강수: <strong className="text-blue-400">{activeReg.rain} mm/h</strong></div>
                            <div className="break-keep text-slate-300 mt-1">• {activeReg.riskDescription}</div>
                          </div>
                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80 text-[10px] sm:text-[11px] flex-wrap">
                            {activeReg.isFloodingRisk && (
                              <span className="text-red-400 font-semibold flex items-center whitespace-nowrap">
                                ⚠️ 지하차도 차단 권고
                              </span>
                            )}
                            {activeReg.isColdWaveRisk && (
                              <span className="text-cyan-400 font-semibold flex items-center whitespace-nowrap">
                                ❄️ 하우스 보온 가동
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 권역별 인터랙티브 카드 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {weather?.regions.map((region) => (
                    <div
                      key={region.code}
                      onClick={() => setSelectedRegion(region.code)}
                      className={`p-3 rounded-xl border cursor-pointer transition min-w-0 ${
                        selectedRegion === region.code
                          ? 'bg-slate-800 border-orange-500 shadow-md ring-1 ring-orange-500'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                        <span className="font-bold text-xs sm:text-sm text-white flex items-center truncate">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                          {region.name}
                        </span>
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap border ${
                            region.alertLevel === '심각'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : region.alertLevel === '경고'
                              ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                              : region.alertLevel === '주의'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          }`}
                        >
                          {region.alertLevel} 단계
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-[11px] sm:text-xs text-slate-300 mb-1.5">
                        <span className="flex items-center">
                          <CloudRain className="w-3 h-3 mr-1 text-blue-400 shrink-0" />
                          강수 {region.rain}mm
                        </span>
                        <span className="flex items-center">
                          <Thermometer className="w-3 h-3 mr-1 text-orange-400 shrink-0" />
                          기온 {region.temp}℃
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 p-2 rounded-lg break-keep">
                        {region.riskDescription}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 우측: AI 행동 요령 카드 (반응형 글씨 배열 최적화) */}
            <div className="xl:col-span-5 flex flex-col space-y-4 min-w-0">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-xl flex-1 flex flex-col min-w-0">
                {/* AI 카드 헤더 (flex-wrap 및 shrink-0, whitespace-nowrap 적용) */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-slate-800 min-w-0">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold text-white truncate">
                        AI 이상기후 맞춤 행동 요령
                      </h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                        @google/genai • {aiGuide?.modelUsed || 'gemini-3.5-flash-lite'}
                      </p>
                    </div>
                  </div>

                  {/* 위험도 뱃지 (절대 쪼개지거나 줄바꿈되지 않도록 방어) */}
                  {aiGuide ? (
                    <span
                      style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}
                      className={`shrink-0 inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold border transition ${
                        aiGuide.riskLevel === '심각'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : aiGuide.riskLevel === '경고'
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                          : aiGuide.riskLevel === '주의'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      위험도: {aiGuide.riskLevel}
                    </span>
                  ) : loadingAi ? (
                    <span
                      style={{ whiteSpace: 'nowrap' }}
                      className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 animate-pulse"
                    >
                      분석 중...
                    </span>
                  ) : null}
                </div>

                {/* AI 상황 진단 총평 */}
                <div className="my-3.5 p-3 sm:p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 leading-relaxed min-w-0">
                  {loadingAi ? (
                    <div className="flex items-center space-x-2 text-purple-300">
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span className="truncate">Gemini가 기상 위험을 분석 중입니다...</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-200 flex items-center">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-400 mr-1.5 shrink-0" />
                        기상 상황 진단 총평
                      </div>
                      <p className="text-slate-300 break-keep">{aiGuide?.analysis || '기상 분석 대기 중입니다.'}</p>
                    </div>
                  )}
                </div>

                {/* 3줄 요약 카드들 */}
                <div className="space-y-3.5 flex-1 min-w-0">
                  {/* 시민 맞춤 행동 요령 */}
                  <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="w-4 h-4 text-blue-400 shrink-0" />
                      <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wide truncate">
                        시민 맞춤 행동 요령 (3줄 요약)
                      </h3>
                    </div>
                    {loadingAi ? (
                      <div className="space-y-2 py-2">
                        <div className="h-3 bg-slate-800 rounded animate-pulse" />
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6" />
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-4/6" />
                      </div>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiGuide?.citizenGuide.map((line, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                            <span className="leading-snug break-keep">{line.replace(/^\d+\.\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* 농가 맞춤 행동 요령 */}
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Tractor className="w-4 h-4 text-amber-400 shrink-0" />
                      <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wide truncate">
                        농가 맞춤 행동 요령 (3줄 요약)
                      </h3>
                    </div>
                    {loadingAi ? (
                      <div className="space-y-2 py-2">
                        <div className="h-3 bg-slate-800 rounded animate-pulse" />
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6" />
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-4/6" />
                      </div>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiGuide?.farmerGuide.map((line, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span className="leading-snug break-keep">{line.replace(/^\d+\.\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* 하단 재생성 푸터 */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                  <span className="truncate">{aiGuide?.isMock ? '사전 방재 매뉴얼' : 'Gemini AI 실시간 생성'}</span>
                  <button
                    onClick={() => weather && fetchAiGuide(weather, ++lastRequestIdRef.current)}
                    disabled={loadingAi}
                    className="text-purple-400 hover:text-purple-300 flex items-center font-medium disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${loadingAi ? 'animate-spin' : ''}`} />
                    AI 가이드 다시 생성
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
