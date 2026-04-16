import { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, Sun, Cloud, CloudRain, CloudSnow, CloudDrizzle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const AMBER = '#ffb000';
const AMBER_DIM = '#7a5500';
const GREEN = '#00ff66';
const RED = '#ff3344';
const BG = '#0a0a0a';
const PANEL = '#121212';
const BORDER = '#2a2a2a';
const MUTED = '#666';

const WEATHER_OPTIONS = [
  { id: 'sunny', label: 'SUN', Icon: Sun, weight: 15 },
  { id: 'mild', label: 'MILD', Icon: CloudDrizzle, weight: 8 },
  { id: 'grey', label: 'GREY', Icon: Cloud, weight: 0 },
  { id: 'rain', label: 'RAIN', Icon: CloudRain, weight: 14 },
  { id: 'snow', label: 'SNOW', Icon: CloudSnow, weight: 22 },
];

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_WEIGHTS = [8, -22, -16, -6, 10, 38, 32];

const TICKER_HEADLINES = [
  'GREGGS SAUSAGE ROLL FUTURES STEADY £1.20',
  'PORK SCRATCHINGS +4.3% ON MIDLANDS VOLUME',
  'BoE: RATES TO REMAIN HAWKISH UNTIL KICKOFF',
  'DOOM BAR RALLIES ON HEAVY RAIN FORECAST',
  'ANALYSTS SPLIT ON TUESDAY PINT POTENTIAL',
  'WETHERSPOONS OPENS FLAT, RECOVERS POST-17:00',
  'CARLING REPORTS "ABSOLUTELY FINE" Q3 EARNINGS',
  'PICKLED EGG INDEX HITS 52-WEEK HIGH',
  'FTSE PUBS 100 +2.1% ON STRONG FRIDAY OUTLOOK',
  'LIME CORDIAL DEMAND COLLAPSES; BITTER HOLDS',
  'CRISP AISLE VOLATILITY SPREADS TO NUTS SECTOR',
  'JUKEBOX SENTIMENT REACHES PEAK 90s',
  'BEER GARDEN OCCUPANCY +12% W/W',
  'PEANUT-TO-PINT RATIO SIGNALS OVERHEATING',
  'GUINNESS SETTLEMENT TIME UNCHANGED 119.5s',
  'DRIED LIME ON CORONA: SHORT POSITION CLOSED',
  'BMI FUTURES TURN BEARISH ON IPA EXPOSURE',
  'PARKRUN TIMES INVERSELY CORRELATE W/ STELLA',
  'WAISTLINE-TO-WALLET RATIO AT TIPPING POINT',
  'ANALYST: "EVERY PINT IS 180 KCAL, ROUGHLY"',
  'GYM ATTENDANCE PROXY HITS 6-MONTH HIGH',
  'LIVER ENZYMES STABLE; OUTLOOK UNDER REVIEW',
  'PROTEIN-TO-PINT RATIO COLLAPSES IN MIDLANDS',
];

const COMPONENTS = [
  { key: 'DWI', name: 'DAY-OF-WEEK', max: 38 },
  { key: 'TIM', name: 'TIME-OF-DAY', max: 20 },
  { key: 'WTH', name: 'WEATHER', max: 22 },
  { key: 'PAY', name: 'PAYROLL PRX', max: 15 },
  { key: 'OBL', name: 'AM. OBLIGATIONS', max: 25 },
  { key: 'SOC', name: 'SOCIAL FACTOR', max: 15 },
  { key: 'PHY', name: 'PHYSIQUE FACTOR', max: 30 },
  { key: 'MKT', name: 'MARKET NOISE', max: 8 },
];

function computeComponents({ dayOfWeek, hour, weather, daysSincePayday, tomorrowEarly, noPlans, pintsThisWeek, workoutsThisWeek, noise }) {
  const dwi = DAY_WEIGHTS[dayOfWeek];

  let tim;
  if (hour < 12) tim = -20;
  else if (hour < 16) tim = -8;
  else if (hour < 18) tim = 4;
  else if (hour < 22) tim = 18;
  else if (hour < 24) tim = 6;
  else tim = -10;

  const wth = WEATHER_OPTIONS.find(w => w.id === weather)?.weight ?? 0;

  let pay;
  if (daysSincePayday <= 3) pay = 15;
  else if (daysSincePayday <= 10) pay = 6;
  else if (daysSincePayday <= 20) pay = -2;
  else pay = -15;

  const obl = tomorrowEarly ? -25 : 8;
  const soc = noPlans ? 14 : -4;

  // Physique factor: pints accelerate the penalty; workouts buy back leniency.
  let pintPenalty;
  if (pintsThisWeek <= 1) pintPenalty = pintsThisWeek * 1;
  else if (pintsThisWeek <= 4) pintPenalty = 1 + (pintsThisWeek - 1) * 3;
  else pintPenalty = 10 + (pintsThisWeek - 4) * 5;
  const workoutBonus = workoutsThisWeek * 3;
  const phy = Math.max(-30, Math.min(12, workoutBonus - pintPenalty));

  const mkt = noise;

  return { DWI: dwi, TIM: tim, WTH: wth, PAY: pay, OBL: obl, SOC: soc, PHY: phy, MKT: mkt };
}

function computeBAI(parts) {
  const total = 50 + Object.values(parts).reduce((a, b) => a + b, 0);
  return Math.max(0, Math.min(100, total));
}

// WMO weather code → our 5-bucket categories
function wmoToWeather(code) {
  if (code === 0) return 'sunny';
  if (code === 1 || code === 2) return 'mild';
  if (code === 3 || code === 45 || code === 48) return 'grey';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code === 95 || code === 96 || code === 99) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'grey';
}

async function getLocation() {
  // Try browser geolocation first
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('geo timeout')), 8000);
        navigator.geolocation.getCurrentPosition(
          p => { clearTimeout(timer); resolve(p); },
          e => { clearTimeout(timer); reject(e); },
          { timeout: 7000, maximumAge: 600000, enableHighAccuracy: false }
        );
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' };
    } catch (e) {
      // fall through to IP
    }
  }
  // IP-based fallback
  const r = await fetch('https://ipapi.co/json/');
  if (!r.ok) throw new Error('ip lookup failed');
  const d = await r.json();
  if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') throw new Error('ip lookup empty');
  return { lat: d.latitude, lng: d.longitude, city: d.city, source: 'ip' };
}

async function getWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('weather fetch failed');
  const d = await r.json();
  return {
    temp: d.current?.temperature_2m,
    code: d.current?.weather_code,
    units: d.current_units?.temperature_2m || '°C',
  };
}

async function getCity(lat, lng) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.city || d.locality || d.principalSubdivision || null;
  } catch {
    return null;
  }
}

function getVerdict(score) {
  if (score < 26) return { label: 'SOBER', sub: 'STAND DOWN', color: RED };
  if (score < 51) return { label: 'SENSIBLE', sub: 'PROCEED W/ CAUTION', color: '#ffaa00' };
  if (score < 76) return { label: 'SCHOONER', sub: 'CLEARED FOR PINT', color: GREEN };
  return { label: 'SEND IT', sub: 'STRONG BUY', color: '#00ff99' };
}

// Generate plausible random-walk history ending at currentScore
function generateHistory(currentScore, points = 48) {
  const history = [];
  let val = 45 + Math.random() * 10;
  history.push(val);
  for (let i = 1; i < points - 1; i++) {
    val += (Math.random() - 0.5) * 6;
    val = Math.max(10, Math.min(90, val));
    history.push(val);
  }
  history.push(currentScore);
  return history;
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = 100;
  const min = 0;
  const max = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  const lastX = w;
  const lastY = h - ((data[data.length - 1] - min) / (max - min)) * h;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* horizontal grid */}
      {[25, 50, 75].map(y => (
        <line key={y} x1="0" y1={y} x2={w} y2={y} stroke={BORDER} strokeWidth="0.3" strokeDasharray="1,1" />
      ))}
      <polyline
        points={`0,${h} ${points} ${w},${h}`}
        fill="url(#fade)"
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="1.6" fill={color} />
    </svg>
  );
}

function TickerTape({ items, direction = 'left', speed = 60 }) {
  const content = items.join('   •   ');
  const animName = direction === 'left' ? 'tickerL' : 'tickerR';
  return (
    <div className="overflow-hidden whitespace-nowrap py-1.5 border-y" style={{ borderColor: BORDER, background: '#000' }}>
      <div
        className="inline-block whitespace-nowrap text-xs tracking-wider"
        style={{
          color: AMBER,
          animation: `${animName} ${speed}s linear infinite`,
          willChange: 'transform',
        }}
      >
        <span className="pr-6">{content}</span>
        <span className="pr-6">{content}</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-3 py-2 border text-left"
      style={{ borderColor: BORDER, background: PANEL }}
    >
      <span className="text-[10px] tracking-widest" style={{ color: MUTED }}>{label}</span>
      <span
        className="text-xs font-bold tracking-widest px-2 py-0.5"
        style={{
          color: value ? '#000' : AMBER,
          background: value ? AMBER : 'transparent',
          border: `1px solid ${AMBER}`,
        }}
      >
        {value ? 'YES' : 'NO'}
      </span>
    </button>
  );
}

export default function BeerIndex() {
  const initialNow = new Date();
  const [dayOfWeek] = useState(initialNow.getDay());
  const [hour] = useState(initialNow.getHours());
  const [weather, setWeather] = useState('grey');
  const [weatherSource, setWeatherSource] = useState('loading'); // loading | live | manual | error
  const [liveTemp, setLiveTemp] = useState(null);
  const [liveCity, setLiveCity] = useState(null);
  const [tempUnits, setTempUnits] = useState('°C');
  const [weatherErr, setWeatherErr] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [daysSincePayday, setDaysSincePayday] = useState(7);
  const [pintsThisWeek, setPintsThisWeek] = useState(2);
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(2);
  const [tomorrowEarly, setTomorrowEarly] = useState(false);
  const [noPlans, setNoPlans] = useState(true);
  const [noise, setNoise] = useState(0);
  const [now, setNow] = useState(initialNow);
  const [pulse, setPulse] = useState(true);

  // live tick
  useEffect(() => {
    const id = setInterval(() => {
      setNoise(prev => {
        const drift = (Math.random() - 0.5) * 3;
        return Math.max(-8, Math.min(8, prev + drift));
      });
      setNow(new Date());
      setPulse(p => !p);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  // live weather feed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWeatherSource(prev => (prev === 'manual' ? 'manual' : 'loading'));
      setWeatherErr(null);
      try {
        const loc = await getLocation();
        const w = await getWeather(loc.lat, loc.lng);
        let city = loc.city || null;
        if (!city) city = await getCity(loc.lat, loc.lng);
        if (cancelled) return;
        const mapped = wmoToWeather(w.code);
        setLiveTemp(typeof w.temp === 'number' ? w.temp : null);
        setTempUnits(w.units || '°C');
        setLiveCity(city);
        // Only auto-apply if user hasn't manually overridden
        setWeatherSource(prevSrc => {
          if (prevSrc === 'manual') return 'manual';
          setWeather(mapped);
          return 'live';
        });
      } catch (e) {
        if (cancelled) return;
        setWeatherErr(String(e?.message || e));
        setWeatherSource(prev => (prev === 'manual' ? 'manual' : 'error'));
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const refreshWeather = () => {
    // Re-fetch and re-apply (overrides manual selection)
    setWeatherSource('loading');
    setRefreshTick(t => t + 1);
  };

  const setWeatherManual = (id) => {
    setWeather(id);
    setWeatherSource('manual');
  };

  const components = useMemo(
    () => computeComponents({ dayOfWeek, hour, weather, daysSincePayday, tomorrowEarly, noPlans, pintsThisWeek, workoutsThisWeek, noise }),
    [dayOfWeek, hour, weather, daysSincePayday, tomorrowEarly, noPlans, pintsThisWeek, workoutsThisWeek, noise]
  );

  const score = computeBAI(components);
  const verdict = getVerdict(score);

  // Track previous score for delta display
  const prevScoreRef = useRef(score);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const d = score - prevScoreRef.current;
    setDelta(d);
    prevScoreRef.current = score;
  }, [score]);

  // History — regenerate base when day-level inputs change, not on noise
  const baseHistory = useMemo(
    () => generateHistory(score, 48),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayOfWeek, weather, daysSincePayday, tomorrowEarly, noPlans, pintsThisWeek, workoutsThisWeek]
  );
  const history = useMemo(() => {
    const h = [...baseHistory];
    h[h.length - 1] = score;
    return h;
  }, [baseHistory, score]);

  const ts = now.toTimeString().slice(0, 8);
  const dateStr = now.toDateString().toUpperCase();

  const arrowColor = delta >= 0 ? GREEN : RED;
  const ArrowIcon = delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <div
      className="min-h-screen w-full font-mono text-xs"
      style={{ background: BG, color: AMBER }}
    >
      <style>{`
        @keyframes tickerL {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes tickerR {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.92; }
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.15; }
        }
        .crt {
          text-shadow: 0 0 6px currentColor, 0 0 14px currentColor;
          animation: flicker 3s infinite;
        }
        .scanlines::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0) 0px,
            rgba(0,0,0,0) 2px,
            rgba(0,0,0,0.18) 3px,
            rgba(0,0,0,0) 4px
          );
          pointer-events: none;
          z-index: 2;
        }
      `}</style>

      {/* Top ticker */}
      <TickerTape items={TICKER_HEADLINES} direction="left" speed={70} />

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: BORDER, background: '#000' }}>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: RED, opacity: pulse ? 1 : 0.2, transition: 'opacity 0.2s' }}
          />
          <span className="text-[10px] tracking-[0.2em]" style={{ color: RED }}>LIVE</span>
          <span className="text-[10px] tracking-widest" style={{ color: MUTED }}>•</span>
          <span className="text-[10px] tracking-widest" style={{ color: MUTED }}>{dateStr}</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity size={11} style={{ color: AMBER }} />
          <span className="text-[10px] tracking-widest tabular-nums" style={{ color: AMBER }}>{ts}</span>
        </div>
      </div>

      {/* Title */}
      <div className="px-3 pt-4 pb-1">
        <div className="text-[10px] tracking-[0.3em]" style={{ color: MUTED }}>BLACKWELL FINANCIAL · TERMINAL v4.6</div>
        <div className="text-base tracking-[0.2em] mt-0.5" style={{ color: AMBER }}>
          BAI · BEER APPROVAL INDEX
        </div>
      </div>

      {/* Main quote panel */}
      <div className="relative mx-3 my-3 border scanlines" style={{ borderColor: BORDER, background: PANEL }}>
        <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
          <span className="text-[10px] tracking-widest" style={{ color: MUTED }}>BAI:LON</span>
          <span className="text-[10px] tracking-widest" style={{ color: MUTED }}>RT QUOTE</span>
        </div>
        <div className="px-4 pb-3 flex items-end gap-3">
          <div
            className="text-7xl tabular-nums leading-none crt font-bold"
            style={{ color: verdict.color, letterSpacing: '-0.02em' }}
          >
            {score.toFixed(1)}
          </div>
          <div className="flex flex-col items-start pb-1">
            <div className="flex items-center gap-1" style={{ color: arrowColor }}>
              <ArrowIcon size={14} />
              <span className="text-sm tabular-nums font-bold">
                {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] tabular-nums" style={{ color: arrowColor }}>
              ({((delta / Math.max(score - delta, 1)) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Verdict band */}
        <div
          className="px-4 py-2 flex items-center justify-between border-t"
          style={{ borderColor: BORDER, background: '#000' }}
        >
          <div>
            <div className="text-[10px] tracking-widest" style={{ color: MUTED }}>VERDICT</div>
            <div className="text-2xl font-bold tracking-[0.15em] crt" style={{ color: verdict.color }}>
              {verdict.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-widest" style={{ color: MUTED }}>RATING</div>
            <div className="text-xs tracking-widest font-bold" style={{ color: verdict.color }}>
              {verdict.sub}
            </div>
          </div>
        </div>

        {/* Sparkline */}
        <div className="border-t" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between px-4 pt-2">
            <span className="text-[10px] tracking-widest" style={{ color: MUTED }}>INTRADAY · 1D</span>
            <span className="text-[10px] tabular-nums" style={{ color: MUTED }}>
              H {Math.max(...history).toFixed(1)} · L {Math.min(...history).toFixed(1)}
            </span>
          </div>
          <div className="h-24 px-2 pb-2">
            <Sparkline data={history} color={verdict.color} />
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="mx-3 mb-3 border" style={{ borderColor: BORDER, background: PANEL }}>
        <div className="px-3 py-1.5 border-b flex items-center justify-between" style={{ borderColor: BORDER, background: '#000' }}>
          <span className="text-[10px] tracking-[0.2em]" style={{ color: AMBER }}>COMPONENT WEIGHTING</span>
          <span className="text-[10px]" style={{ color: MUTED }}>Σ {Object.values(components).reduce((a,b)=>a+b,0).toFixed(1)}</span>
        </div>
        <div>
          {COMPONENTS.map(({ key, name, max }) => {
            const v = components[key] ?? 0;
            const pct = Math.abs(v) / max;
            const positive = v >= 0;
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: BORDER }}>
                <span className="text-[10px] tracking-widest w-12" style={{ color: MUTED }}>{key}</span>
                <span className="text-[10px] flex-1" style={{ color: AMBER_DIM }}>{name}</span>
                <div className="flex items-center gap-2 w-32 justify-end">
                  <div className="flex w-20 h-1.5" style={{ background: '#000' }}>
                    <div className="w-1/2 flex justify-end">
                      {!positive && (
                        <div
                          style={{
                            width: `${Math.min(pct * 100, 100)}%`,
                            background: RED,
                            height: '100%',
                          }}
                        />
                      )}
                    </div>
                    <div className="w-px h-full" style={{ background: BORDER }} />
                    <div className="w-1/2">
                      {positive && (
                        <div
                          style={{
                            width: `${Math.min(pct * 100, 100)}%`,
                            background: GREEN,
                            height: '100%',
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[10px] tabular-nums w-10 text-right font-bold"
                    style={{ color: positive ? GREEN : RED }}
                  >
                    {positive ? '+' : ''}{v.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inputs */}
      <div className="mx-3 mb-3 border" style={{ borderColor: BORDER, background: PANEL }}>
        <div className="px-3 py-1.5 border-b" style={{ borderColor: BORDER, background: '#000' }}>
          <span className="text-[10px] tracking-[0.2em]" style={{ color: AMBER }}>MARKET INPUTS</span>
        </div>

        <div className="p-3 space-y-3">
          {/* Day & time read-only */}
          <div className="grid grid-cols-2 gap-2">
            <div className="border px-2 py-1.5" style={{ borderColor: BORDER }}>
              <div className="text-[9px] tracking-widest" style={{ color: MUTED }}>SESSION</div>
              <div className="text-sm tracking-widest font-bold" style={{ color: AMBER }}>{DAYS[dayOfWeek]}</div>
            </div>
            <div className="border px-2 py-1.5" style={{ borderColor: BORDER }}>
              <div className="text-[9px] tracking-widest" style={{ color: MUTED }}>HOUR</div>
              <div className="text-sm tracking-widest font-bold tabular-nums" style={{ color: AMBER }}>
                {String(hour).padStart(2, '0')}:00
              </div>
            </div>
          </div>

          {/* Weather selector with live feed */}
          <div>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-[9px] tracking-widest" style={{ color: MUTED }}>WEATHER FEED</span>
              <div className="flex items-center gap-2">
                {weatherSource === 'loading' && (
                  <span className="text-[9px] tracking-widest flex items-center gap-1" style={{ color: AMBER_DIM }}>
                    <RefreshCw size={9} className="animate-spin" /> CONNECTING…
                  </span>
                )}
                {weatherSource === 'live' && (
                  <span className="text-[9px] tracking-widest flex items-center gap-1" style={{ color: GREEN }}>
                    <Wifi size={9} />
                    {liveCity ? `${liveCity.toUpperCase()} · ` : ''}
                    {liveTemp !== null ? `${liveTemp.toFixed(1)}${tempUnits}` : 'LIVE'}
                  </span>
                )}
                {weatherSource === 'manual' && (
                  <span className="text-[9px] tracking-widest flex items-center gap-1" style={{ color: AMBER }}>
                    MANUAL OVERRIDE
                  </span>
                )}
                {weatherSource === 'error' && (
                  <span className="text-[9px] tracking-widest flex items-center gap-1" style={{ color: RED }}>
                    <WifiOff size={9} /> NO FEED
                  </span>
                )}
                <button
                  onClick={refreshWeather}
                  className="flex items-center justify-center w-5 h-5 border"
                  style={{ borderColor: BORDER, color: AMBER }}
                  aria-label="refresh weather"
                >
                  <RefreshCw size={9} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {WEATHER_OPTIONS.map(({ id, label, Icon }) => {
                const active = weather === id;
                return (
                  <button
                    key={id}
                    onClick={() => setWeatherManual(id)}
                    className="flex flex-col items-center gap-1 py-1.5 border"
                    style={{
                      borderColor: active ? AMBER : BORDER,
                      background: active ? AMBER : 'transparent',
                      color: active ? '#000' : AMBER_DIM,
                    }}
                  >
                    <Icon size={14} />
                    <span className="text-[9px] tracking-wider font-bold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payday slider */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] tracking-widest" style={{ color: MUTED }}>DAYS SINCE PAYDAY</span>
              <span className="text-[10px] tabular-nums font-bold" style={{ color: AMBER }}>{daysSincePayday}d</span>
            </div>
            <input
              type="range"
              min="0"
              max="31"
              value={daysSincePayday}
              onChange={e => setDaysSincePayday(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: AMBER }}
            />
          </div>

          {/* Pints this week */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] tracking-widest" style={{ color: MUTED }}>PINTS BANKED THIS WEEK</span>
              <span className="text-[10px] tabular-nums font-bold" style={{ color: pintsThisWeek > 5 ? RED : AMBER }}>{pintsThisWeek}</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              value={pintsThisWeek}
              onChange={e => setPintsThisWeek(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: AMBER }}
            />
          </div>

          {/* Workouts this week */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] tracking-widest" style={{ color: MUTED }}>WORKOUTS LOGGED THIS WEEK</span>
              <span className="text-[10px] tabular-nums font-bold" style={{ color: workoutsThisWeek >= 3 ? GREEN : AMBER }}>{workoutsThisWeek}</span>
            </div>
            <input
              type="range"
              min="0"
              max="7"
              value={workoutsThisWeek}
              onChange={e => setWorkoutsThisWeek(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: AMBER }}
            />
          </div>

          {/* Toggles */}
          <ToggleRow label="EARLY START TOMORROW" value={tomorrowEarly} onChange={setTomorrowEarly} />
          <ToggleRow label="EVENING UNCOMMITTED" value={noPlans} onChange={setNoPlans} />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mx-3 mb-3 px-2 py-1.5" style={{ color: MUTED }}>
        <div className="text-[9px] tracking-wider leading-relaxed">
          NOT FINANCIAL ADVICE. NOT MEDICAL ADVICE. NOT, FRANKLY, ANY KIND OF ADVICE.
          PAST PERFORMANCE OF PINTS IS NO GUARANTEE OF FUTURE RESULTS. PLEASE DRINK RESPONSIBLY.
        </div>
      </div>

      {/* Bottom ticker */}
      <TickerTape items={TICKER_HEADLINES.slice().reverse()} direction="right" speed={85} />
    </div>
  );
}
