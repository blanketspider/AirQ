/* AirAgain — core data & AQI engine
   Part of the AirAgain air-quality monitor. */

/* ============================================================
   AirAgain
   ============================================================ */
const CITIES = [
  // ---- Nepal ----
  {slug:'kathmandu', name:'Kathmandu',   country:'nepal', lat:27.7172, lng:85.3240},
  {slug:'lalitpur',  name:'Lalitpur',    country:'nepal', lat:27.6588, lng:85.3247},
  {slug:'bhaktapur', name:'Bhaktapur',   country:'nepal', lat:27.6710, lng:85.4298},
  {slug:'pokhara',   name:'Pokhara',     country:'nepal', lat:28.2096, lng:83.9856},
  {slug:'biratnagar',name:'Biratnagar',  country:'nepal', lat:26.4525, lng:87.2718},
  {slug:'birgunj',   name:'Birgunj',     country:'nepal', lat:27.0104, lng:84.8770},
  {slug:'bharatpur', name:'Bharatpur',   country:'nepal', lat:27.6768, lng:84.4297},
  {slug:'butwal',    name:'Butwal',      country:'nepal', lat:27.7006, lng:83.4484},
  {slug:'dharan',    name:'Dharan',      country:'nepal', lat:26.8065, lng:87.2846},
  {slug:'nepalgunj', name:'Nepalgunj',   country:'nepal', lat:28.0500, lng:81.6167},
  {slug:'hetauda',   name:'Hetauda',     country:'nepal', lat:27.4280, lng:85.0325},
  {slug:'janakpur',  name:'Janakpur',    country:'nepal', lat:26.7288, lng:85.9266},
  // ---- India ----
  {slug:'delhi',     name:'Delhi',       country:'india', lat:28.6139, lng:77.2090},
  {slug:'mumbai',    name:'Mumbai',      country:'india', lat:19.0760, lng:72.8777},
  {slug:'kolkata',   name:'Kolkata',     country:'india', lat:22.5726, lng:88.3639},
  {slug:'chennai',   name:'Chennai',     country:'india', lat:13.0827, lng:80.2707},
  {slug:'bengaluru', name:'Bengaluru',   country:'india', lat:12.9716, lng:77.5946},
  {slug:'hyderabad', name:'Hyderabad',   country:'india', lat:17.3850, lng:78.4867},
  {slug:'ahmedabad', name:'Ahmedabad',   country:'india', lat:23.0225, lng:72.5714},
  {slug:'pune',      name:'Pune',        country:'india', lat:18.5204, lng:73.8567},
  {slug:'jaipur',    name:'Jaipur',      country:'india', lat:26.9124, lng:75.7873},
  {slug:'lucknow',   name:'Lucknow',     country:'india', lat:26.8467, lng:80.9462},
  {slug:'kanpur',    name:'Kanpur',      country:'india', lat:26.4499, lng:80.3319},
  {slug:'patna',     name:'Patna',       country:'india', lat:25.5941, lng:85.1376},
  {slug:'varanasi',  name:'Varanasi',    country:'india', lat:25.3176, lng:82.9739},
  {slug:'amritsar',  name:'Amritsar',    country:'india', lat:31.6340, lng:74.8723},
];
const COUNTRIES = {
  nepal: {label:'Nepal', center:[28.15, 84.0], zoom:7},
  india: {label:'India', center:[22.5, 79.0], zoom:5},
};
const BREAKPOINTS = {
  pm25:[[0,30,0,50],[31,60,51,100],[61,90,101,200],[91,120,201,300],[121,250,301,400],[251,500,401,500]],
  pm10:[[0,50,0,50],[51,100,51,100],[101,250,101,200],[251,350,201,300],[351,430,301,400],[431,600,401,500]],
  no2: [[0,40,0,50],[41,80,51,100],[81,180,101,200],[181,280,201,300],[281,400,301,400],[401,1000,401,500]],
  co:  [[0,1,0,50],[1.1,2,51,100],[2.1,10,101,200],[10.1,17,201,300],[17.1,34,301,400],[34.1,50,401,500]],
  nh3: [[0,200,0,50],[201,400,51,100],[401,800,101,200],[801,1200,201,300],[1201,1800,301,400],[1801,3000,401,500]],
};
const CATEGORIES = [
  {max:50,  label:'Good',         color:'hsl(140, 40%, 45%)', advisory:'Air quality is good. Ideal for outdoor activity — no precautions needed.'},
  {max:100, label:'Satisfactory', color:'hsl(95, 45%, 45%)',  advisory:'Air quality is acceptable. Unusually sensitive individuals may consider limiting prolonged outdoor exertion.'},
  {max:200, label:'Moderate',     color:'hsl(45, 90%, 50%)',  advisory:'May cause breathing discomfort to people with lung disease, children, and older adults. Consider easing prolonged outdoor exertion.'},
  {max:300, label:'Poor',         color:'hsl(25, 85%, 55%)',  advisory:'Breathing discomfort likely on prolonged exposure. People with heart or lung disease should avoid outdoor exertion and wear an N95 outdoors.'},
  {max:400, label:'Very Poor',    color:'hsl(0, 75%, 50%)',   advisory:'Respiratory illness likely on prolonged exposure. Everyone should limit outdoor activity; sensitive groups should stay indoors.'},
  {max:500, label:'Severe',       color:'hsl(350, 60%, 30%)', advisory:'Serious health impact for all. Avoid outdoor activity, keep windows closed, and run a purifier if you can. Sensitive groups should remain indoors.'},
];
const POLLUTANT_META = [
  {key:'pm25', label:'PM2.5', unit:'µg/m³'}, {key:'pm10', label:'PM10', unit:'µg/m³'},
  {key:'no2', label:'NO₂', unit:'µg/m³'}, {key:'co', label:'CO', unit:'mg/m³'}, {key:'nh3', label:'NH₃', unit:'µg/m³'},
];
function subIndex(p, c){
  if(c==null||isNaN(c)) return 0;
  const b=BREAKPOINTS[p];
  for(const [cl,ch,il,ih] of b){ if(c>=cl&&c<=ch) return Math.round(((ih-il)/(ch-cl))*(c-cl)+il); }
  return c>b[b.length-1][1]?500:0;
}
function categoryFor(a){ return CATEGORIES.find(c=>a<=c.max)||CATEGORIES[CATEGORIES.length-1]; }
function calculateAQI(v){
  const s={}; for(const p of POLLUTANT_META) s[p.key]=subIndex(p.key,v[p.key]);
  let aqi=0,dom='pm25'; for(const k in s){ if(s[k]>aqi){aqi=s[k];dom=k;} }
  const cat=categoryFor(aqi);
  return {aqi,dominant_pollutant:dom,category:cat.label,color:cat.color,health_advisory:cat.advisory,sub_indices:s};
}

/* ---------- Deterministic 30-day history per city ----------
   Seeded PRNG so numbers are stable across reloads. */
function mulberry32(seed){ return function(){ let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
const CITY_PROFILES = {
  kathmandu:{pm25:82,pm10:130,no2:46,co:1.3,nh3:62}, lalitpur:{pm25:74,pm10:118,no2:40,co:1.1,nh3:56},
  bhaktapur:{pm25:88,pm10:140,no2:44,co:1.4,nh3:60}, pokhara:{pm25:32,pm10:58,no2:20,co:0.6,nh3:38},
  biratnagar:{pm25:96,pm10:165,no2:52,co:1.7,nh3:72}, birgunj:{pm25:118,pm10:198,no2:60,co:2.0,nh3:88},
  bharatpur:{pm25:54,pm10:92,no2:32,co:0.9,nh3:46}, butwal:{pm25:64,pm10:108,no2:37,co:1.1,nh3:52},
  dharan:{pm25:44,pm10:78,no2:26,co:0.8,nh3:42}, nepalgunj:{pm25:102,pm10:172,no2:55,co:1.8,nh3:80},
  hetauda:{pm25:58,pm10:98,no2:34,co:1.0,nh3:48}, janakpur:{pm25:90,pm10:150,no2:48,co:1.5,nh3:66},
  // India — representative sample profiles (northern plains higher, south cleaner)
  delhi:{pm25:165,pm10:280,no2:72,co:2.4,nh3:95}, mumbai:{pm25:68,pm10:112,no2:44,co:1.2,nh3:52},
  kolkata:{pm25:108,pm10:172,no2:58,co:1.8,nh3:70}, chennai:{pm25:52,pm10:88,no2:34,co:1.0,nh3:44},
  bengaluru:{pm25:46,pm10:80,no2:38,co:1.1,nh3:40}, hyderabad:{pm25:58,pm10:98,no2:40,co:1.2,nh3:48},
  ahmedabad:{pm25:92,pm10:154,no2:50,co:1.5,nh3:64}, pune:{pm25:60,pm10:102,no2:42,co:1.2,nh3:50},
  jaipur:{pm25:112,pm10:190,no2:54,co:1.6,nh3:74}, lucknow:{pm25:138,pm10:232,no2:64,co:2.0,nh3:84},
  kanpur:{pm25:158,pm10:266,no2:70,co:2.3,nh3:92}, patna:{pm25:142,pm10:238,no2:62,co:2.0,nh3:82},
  varanasi:{pm25:148,pm10:248,no2:66,co:2.1,nh3:86}, amritsar:{pm25:120,pm10:202,no2:56,co:1.7,nh3:76},
};
/* ---------- Season model (Nepal / India) ---------- */
function seasonOf(month){ // month 0-11
  const m = month+1;
  if(m===12||m===1||m===2) return 'winter';
  if(m>=3&&m<=5) return 'pre-monsoon';
  if(m>=6&&m<=9) return 'monsoon';
  return 'post-monsoon';
}
const SEASON_LABEL = {winter:'Winter', 'pre-monsoon':'Pre-monsoon', monsoon:'Monsoon', 'post-monsoon':'Post-monsoon'};
const SEASON_ORDER = ['winter','pre-monsoon','monsoon','post-monsoon'];
// Per-season, per-pollutant multipliers so the DOMINANT pollutant shifts seasonally:
// winter = combustion smog (PM2.5 leads), pre-monsoon = dust (PM10 leads),
// monsoon = rain clears the air (cleanest), post-monsoon = rising again.
const SEASON_MULT = {
  'winter':      {pm25:1.55,pm10:1.25,no2:1.30,co:1.40,nh3:1.20, temp:0.55, hum:1.15},
  'pre-monsoon': {pm25:1.05,pm10:1.85,no2:1.10,co:1.05,nh3:1.15, temp:1.35, hum:0.70},
  'monsoon':     {pm25:0.60,pm10:0.40,no2:0.70,co:0.70,nh3:0.75, temp:1.05, hum:1.45},
  'post-monsoon':{pm25:1.15,pm10:1.05,no2:1.05,co:1.10,nh3:1.00, temp:0.95, hum:1.00},
};

const HISTORY = {};  // slug -> [{date, aqi, season, ...vals, category, color}], oldest first, 365 days incl today
function buildHistory(){
  const today = new Date(); today.setHours(0,0,0,0);
  CITIES.forEach((c,ci)=>{
    const base = CITY_PROFILES[c.slug];
    const rnd = mulberry32(ci*7919 + 13);
    const arr = [];
    for(let d=364; d>=0; d--){
      const date = new Date(today); date.setDate(today.getDate()-d);
      const season = seasonOf(date.getMonth());
      const sm = SEASON_MULT[season];
      const noise = 0.88 + rnd()*0.24;
      const vals = {
        pm25:+(base.pm25*sm.pm25*noise).toFixed(1), pm10:+(base.pm10*sm.pm10*noise).toFixed(1),
        no2:+(base.no2*sm.no2*noise).toFixed(1),  co:+(base.co*sm.co*noise).toFixed(2), nh3:+(base.nh3*sm.nh3*noise).toFixed(1),
      };
      // Weather tracks season (winter cold+humid, pre-monsoon hot+dry, monsoon warm+very humid)
      const temp = +Math.max(2, Math.min(42, 22*sm.temp + (rnd()-0.5)*6)).toFixed(1);
      const humidity = +Math.max(25, Math.min(98, 55*sm.hum + (rnd()-0.5)*14)).toFixed(0);
      arr.push({date, season, ...vals, temp, humidity, ...calculateAQI(vals)});
    }
    HISTORY[c.slug] = arr;
  });

  // ---- Cross-border coupling (for the early-warning analysis) ----
  // Representative sample-data effect: Kathmandu's particulates partly echo the
  // Indo-Gangetic plain (Delhi) a few days later, reflecting real pollution
  // transport into the valley. This is baked into the SAMPLE data so the
  // lag-analysis has a genuine (if synthetic) signal to detect. On real data,
  // the same analysis would reveal whatever true lag exists.
  const LAG = 3, ECHO = 0.6;
  const delhi = HISTORY['delhi'], kath = HISTORY['kathmandu'];
  if(delhi && kath){
    for(let i=0;i<kath.length;i++){
      const src = delhi[Math.max(0, i-LAG)];
      // Kathmandu strongly echoes Delhi's PM from LAG days earlier, so the
      // cross-correlation peaks at the true lag rather than at same-day.
      const vals = {
        pm25:+((1-ECHO)*kath[i].pm25 + ECHO*src.pm25*0.7).toFixed(1),
        pm10:+((1-ECHO)*kath[i].pm10 + ECHO*src.pm10*0.7).toFixed(1),
        no2:kath[i].no2, co:kath[i].co, nh3:kath[i].nh3,
      };
      kath[i] = {...kath[i], ...vals, ...calculateAQI(vals)};
    }
  }
}
function latest(slug){
  // If we have a live reading for this city, use it; otherwise fall back to sample.
  if(LIVE[slug]) return LIVE[slug];
  const h=HISTORY[slug]; return h[h.length-1];
}

/* ============================================================
   LIVE DATA (World Air Quality Index / aqicn.org)
   Fetches CURRENT air quality for each city. Historical features
   (trends, forecast, backtest, seasonal, cross-border) continue to
   use representative sample data, since the free tier provides
   current readings rather than long history.
   ============================================================ */
const WAQI_TOKEN = "85f3338ae80e13b161d7063c197e48676ec6864a";
const LIVE = {};          // slug -> live reading object
const LIVE_STATUS = {};   // slug -> 'live' | 'none' | 'error'
let liveFetchDone = false;

// WAQI's iaqi values are already AQI sub-indices (US EPA scale), not raw
// concentrations — so we use its reported AQI directly rather than re-running
// the CPCB formula, which would produce incorrect numbers.
async function fetchLive(city){
  try{
    const url = `https://api.waqi.info/feed/${encodeURIComponent(city.name)}/?token=${WAQI_TOKEN}`;
    const res = await fetch(url);
    if(!res.ok) { LIVE_STATUS[city.slug]='error'; return null; }
    const j = await res.json();
    if(j.status !== 'ok' || !j.data || typeof j.data.aqi !== 'number'){
      LIVE_STATUS[city.slug] = 'none'; return null;
    }
    const d = j.data;
    const aqi = Math.round(d.aqi);
    const cat = categoryFor(aqi);
    const iaqi = d.iaqi || {};
    const num = k => (iaqi[k] && typeof iaqi[k].v === 'number') ? iaqi[k].v : null;
    // Build sub-index map from whatever pollutants the station reports
    const sub = {};
    for(const p of POLLUTANT_META){ const v = num(p.key); if(v!=null) sub[p.key] = Math.round(v); }
    const dom = d.dominentpol && sub[d.dominentpol]!=null ? d.dominentpol
              : (Object.keys(sub).sort((a,b)=>sub[b]-sub[a])[0] || 'pm25');
    const reading = {
      city_slug: city.slug, city_name: city.name,
      aqi, category: cat.label, color: cat.color, health_advisory: cat.advisory,
      dominant_pollutant: dom,
      sub_indices: Object.keys(sub).length ? sub : {pm25:aqi},
      // raw-ish values for display (WAQI reports sub-indices; shown as reported)
      pm25: num('pm25'), pm10: num('pm10'), no2: num('no2'), co: num('co'), nh3: num('nh3'),
      station: (d.city && d.city.name) || city.name,
      updated: (d.time && (d.time.s || d.time.iso)) || null,
      isLive: true,
    };
    LIVE[city.slug] = reading;
    LIVE_STATUS[city.slug] = 'live';
    return reading;
  }catch(err){
    LIVE_STATUS[city.slug] = 'error';
    return null;
  }
}

async function loadLiveData(){
  // Fetch all cities in parallel; failures are silent and fall back to sample data.
  await Promise.all(CITIES.map(c => fetchLive(c)));
  liveFetchDone = true;
  const n = Object.keys(LIVE).length;
  // Refresh everything that depends on "current" values
  try{
    renderDashboard();
    refreshMapColors();
    updateLiveBanner(n);
    try{ AABackend.refreshAlertBar(); }catch(e){}
  }catch(e){ console.error('live refresh:', e); }
}

function updateLiveBanner(n){
  const el = $('live-banner');
  if(!el) return;
  if(n > 0){
    el.className = 'live-banner is-live';
    el.innerHTML = `<span class="live-dot"></span> <b>Live data</b> — current air quality from ${n} of ${CITIES.length} monitoring stations (World Air Quality Index). Cities without a live station show representative sample values. Historical charts below use sample data.`;
  } else {
    el.className = 'live-banner';
    el.innerHTML = `Live data unavailable right now — showing representative sample values throughout.`;
  }
}

function refreshMapColors(){
  if(!leafletMap) return;
  CITIES.forEach(city=>{
    const m = mapMarkers[city.slug]; if(!m) return;
    const r = latest(city.slug);
    m.setStyle({ fillColor: r.color });
    m.bindPopup(`<div style="text-align:center;font-family:sans-serif"><div style="font-weight:600">${city.name}</div><div style="font-size:1.2rem;font-weight:800;color:${r.color}">AQI ${r.aqi}</div><div style="font-size:.75rem;color:#666">${r.category}${r.isLive?' · live':''}</div></div>`);
  });
}
function seriesFor(slug, days){ const h=HISTORY[slug]; return h.slice(h.length-days); }
function fullYear(slug){ return HISTORY[slug]; }

/* ---------- Dominant-pollutant analysis (overall + by season) ---------- */