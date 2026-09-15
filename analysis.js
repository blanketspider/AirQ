/* AirAgain — statistical analysis (regression, forecast, backtest, correlation)
   Part of the AirAgain air-quality monitor. */

function dominantAnalysis(slug){
  const rows = HISTORY[slug];
  const overall = {}, bySeason = {};
  for(const s of SEASON_ORDER) bySeason[s] = {counts:{}, n:0};
  for(const r of rows){
    overall[r.dominant_pollutant] = (overall[r.dominant_pollutant]||0)+1;
    const b = bySeason[r.season];
    b.counts[r.dominant_pollutant] = (b.counts[r.dominant_pollutant]||0)+1;
    b.n++;
  }
  const n = rows.length;
  const pct = obj => {
    const out = Object.entries(obj).map(([k,v])=>({key:k, count:v, pct:v/n*100}));
    return out.sort((a,b)=>b.count-a.count);
  };
  const seasonPct = {};
  for(const s of SEASON_ORDER){
    const b = bySeason[s];
    seasonPct[s] = {
      n:b.n,
      items: Object.entries(b.counts).map(([k,v])=>({key:k,count:v,pct:b.n?v/b.n*100:0})).sort((a,b)=>b.count-a.count)
    };
  }
  return {overall:pct(overall), n, bySeason:seasonPct};
}
function pollLabel(key){ const m=POLLUTANT_META.find(p=>p.key===key); return m?m.label:key; }

/* ---------- Cross-border lag analysis (Delhi → Kathmandu) ----------
   Measures how a "downwind" city's AQI tracks an "upwind" city's AQI at
   various day-offsets, using Pearson correlation at each lag. The lag with the
   strongest correlation is the apparent lead time. This is the standard
   cross-correlation method for detecting a lead/lag relationship. */
function pearson(a, b){
  const n = Math.min(a.length, b.length);
  if(n < 3) return 0;
  let ma=0, mb=0;
  for(let i=0;i<n;i++){ ma+=a[i]; mb+=b[i]; }
  ma/=n; mb/=n;
  let sab=0, saa=0, sbb=0;
  for(let i=0;i<n;i++){ const da=a[i]-ma, db=b[i]-mb; sab+=da*db; saa+=da*da; sbb+=db*db; }
  const d = Math.sqrt(saa*sbb);
  return d>0 ? sab/d : 0;
}
function lagAnalysis(downwindSlug, upwindSlug, maxLag=7){
  const down = HISTORY[downwindSlug].map(r=>r.aqi);
  const up   = HISTORY[upwindSlug].map(r=>r.aqi);
  const n = down.length;
  const results = [];
  for(let lag=0; lag<=maxLag; lag++){
    // correlate downwind[t] with upwind[t-lag]
    const a = down.slice(lag);
    const b = up.slice(0, n-lag);
    results.push({ lag, r: pearson(a, b) });
  }
  let best = results[0];
  for(const x of results) if(x.r > best.r) best = x;
  return { results, best, sameDay: results[0].r,
           downwind: cityName(downwindSlug), upwind: cityName(upwindSlug) };
}

/* ---------- Regression: predict AQI from temperature & humidity ----------
   Ordinary least squares via normal equations (pure JS, no libraries). */
function olsFit(features, y){
  // features: array of columns (each an array of length m). Include the intercept column of 1s.
  const m = y.length, k = features.length;
  const A = Array.from({length:k},()=>Array(k).fill(0)), bb = Array(k).fill(0);
  for(let i=0;i<k;i++){
    for(let j=0;j<k;j++){ let s=0; for(let r=0;r<m;r++) s+=features[i][r]*features[j][r]; A[i][j]=s; }
    let s=0; for(let r=0;r<m;r++) s+=features[i][r]*y[r]; bb[i]=s;
  }
  const M = A.map((row,i)=>[...row,bb[i]]);
  for(let col=0;col<k;col++){
    let piv=col; for(let r=col+1;r<k;r++) if(Math.abs(M[r][col])>Math.abs(M[piv][col])) piv=r;
    [M[col],M[piv]]=[M[piv],M[col]];
    const d=M[col][col]; if(Math.abs(d)<1e-12) return null;
    for(let c=col;c<=k;c++) M[col][c]/=d;
    for(let r=0;r<k;r++){ if(r!==col){ const f=M[r][col]; for(let c=col;c<=k;c++) M[r][c]-=f*M[col][c]; } }
  }
  return M.map(row=>row[k]);
}
function rSquared(features, y, beta){
  const m=y.length, mean=y.reduce((a,b)=>a+b,0)/m;
  let ssr=0, sst=0;
  for(let r=0;r<m;r++){ let p=0; for(let i=0;i<features.length;i++) p+=beta[i]*features[i][r]; ssr+=(y[r]-p)**2; sst+=(y[r]-mean)**2; }
  return sst>0 ? 1-ssr/sst : 0;
}
// Fit both models for a city's history window
function fitRegression(slug, days){
  // Fit on the FULL YEAR: temperature & humidity vary meaningfully across seasons,
  // which is where the real weather↔AQI relationship lives. (A single month is
  // all one season, so weather barely varies and the fit is meaningless.)
  const rows = HISTORY[slug];
  const t = rows.map(r=>r.temp), h = rows.map(r=>r.humidity), y = rows.map(r=>r.aqi);
  const ones = t.map(()=>1);
  // Linear: AQI = b0 + b1*temp + b2*humidity
  const linFeat = [ones, t, h];
  const linBeta = olsFit(linFeat, y);
  const linR2 = linBeta ? rSquared(linFeat, y, linBeta) : 0;
  // Polynomial (deg 2): + temp^2, humidity^2, temp*humidity
  const polyFeat = [ones, t, h, t.map(x=>x*x), h.map(x=>x*x), t.map((x,i)=>x*h[i])];
  const polyBeta = olsFit(polyFeat, y);
  const polyR2 = polyBeta ? rSquared(polyFeat, y, polyBeta) : 0;
  return {linBeta, linR2, polyBeta, polyR2, n:y.length};
}
function predictLinear(beta, temp, hum){ return beta[0] + beta[1]*temp + beta[2]*hum; }
function predictPoly(beta, temp, hum){ return beta[0] + beta[1]*temp + beta[2]*hum + beta[3]*temp*temp + beta[4]*hum*hum + beta[5]*temp*hum; }
function clampAQI(v){ return Math.max(0, Math.min(500, Math.round(v))); }

/* ---------- Short-term forecast: OLS trend on recent AQI, projected forward ---------- */
function forecast(slug, historyDays, futureDays){
  const rows = seriesFor(slug, historyDays);
  const y = rows.map(r=>r.aqi);
  const n = y.length;
  const xs = y.map((_,i)=>i);
  const xbar = xs.reduce((a,b)=>a+b,0)/n, ybar = y.reduce((a,b)=>a+b,0)/n;
  let sxy=0, sxx=0;
  for(let i=0;i<n;i++){ sxy+=(xs[i]-xbar)*(y[i]-ybar); sxx+=(xs[i]-xbar)**2; }
  const slope = sxx>0 ? sxy/sxx : 0;
  const intercept = ybar - slope*xbar;
  // residual std error for the band
  let ssr=0; for(let i=0;i<n;i++){ const p=intercept+slope*xs[i]; ssr+=(y[i]-p)**2; }
  const s = n>2 ? Math.sqrt(ssr/(n-2)) : 0;
  const band = 1.96*s;
  const lastDate = rows[rows.length-1].date;
  const out = [];
  for(let k=1;k<=futureDays;k++){
    const val = intercept + slope*(n-1+k);
    const date = new Date(lastDate); date.setDate(lastDate.getDate()+k);
    out.push({date, aqi:clampAQI(val), lo:clampAQI(val-band), hi:clampAQI(val+band)});
  }
  return {points:out, slope, band};
}

/* ---------- Backtest: walk-forward evaluation of the forecast ----------
   For each test day, fit OLS trend on the trailing window, predict the next
   day, and compare to what actually happened. Report MAE & RMSE, plus a
   naive persistence baseline (tomorrow = today) so the model has something
   honest to be measured against. */
function fitPredictNext(windowY){
  const m = windowY.length;
  if(m < 2) return windowY[m-1];
  const xbar = (m-1)/2;
  const ybar = windowY.reduce((a,b)=>a+b,0)/m;
  let sxy=0, sxx=0;
  for(let i=0;i<m;i++){ sxy+=(i-xbar)*(windowY[i]-ybar); sxx+=(i-xbar)**2; }
  const slope = sxx>0 ? sxy/sxx : 0;
  const intercept = ybar - slope*xbar;
  return intercept + slope*m;   // predict x = m (the next day)
}
function backtest(slug, windowSize){
  const full = HISTORY[slug].map(r=>r.aqi);   // full 30-day series
  const n = full.length;
  const modelErr = [], naiveErr = [];
  const rows = [];
  for(let t=windowSize; t<n; t++){
    const train = full.slice(t-windowSize, t);
    const pred = clampAQI(fitPredictNext(train));
    const naive = train[train.length-1];        // persistence baseline
    const actual = full[t];
    modelErr.push(pred-actual);
    naiveErr.push(naive-actual);
    rows.push({date:HISTORY[slug][t].date, actual, pred});
  }
  const mae = e => e.reduce((s,x)=>s+Math.abs(x),0)/e.length;
  const rmse = e => Math.sqrt(e.reduce((s,x)=>s+x*x,0)/e.length);
  const mMAE=mae(modelErr), mRMSE=rmse(modelErr), nMAE=mae(naiveErr), nRMSE=rmse(naiveErr);
  const skill = nRMSE>0 ? (1 - mRMSE/nRMSE)*100 : 0;   // % improvement over naive
  return {n:modelErr.length, windowSize, mMAE, mRMSE, nMAE, nRMSE, skill, rows};
}

/* ---------- "What to do today" — a single actionable line tuned to the level ---------- */
function todayTip(aqi){
  if(aqi<=50)  return {icon:'🌿', text:'Air is clean today — a great time for outdoor exercise, a walk, or opening the windows.'};
  if(aqi<=100) return {icon:'🙂', text:'Air is acceptable. Fine for most outdoor plans; the unusually sensitive can take it a touch easier.'};
  if(aqi<=200) return {icon:'😷', text:'Consider easing intense outdoor exercise. Children, older adults, and anyone with breathing issues should take breaks.'};
  if(aqi<=300) return {icon:'⚠️', text:'Wear a sealed N95/KN95 outdoors and keep outdoor time short. Sensitive groups are better off indoors today.'};
  if(aqi<=400) return {icon:'🚫', text:'Limit outdoor activity for everyone. Keep windows shut, run a purifier if you have one, and mask up if you must go out.'};
  return {icon:'🏠', text:'Stay indoors where possible. Seal windows, use a HEPA purifier, and avoid all outdoor exertion — this is hazardous air.'};
}

/* ---------- Statistics ---------- */
function stats(values){
  const n = values.length;
  const sorted = [...values].sort((a,b)=>a-b);
  const mean = values.reduce((s,x)=>s+x,0)/n;
  const median = n%2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2;
  const variance = values.reduce((s,x)=>s+(x-mean)**2,0)/(n-1); // sample variance
  const sd = Math.sqrt(variance);
  const min = sorted[0], max = sorted[n-1];
  const sem = sd/Math.sqrt(n);          // standard error of the mean
  const ci95 = 1.96*sem;                // 95% CI half-width (normal approx)
  const cv = (sd/mean)*100;             // coefficient of variation (%)
  return {n,mean,median,sd,variance,min,max,sem,ci95,cv,range:max-min};
}

/* ============================================================
   DOODLES
   ============================================================ */