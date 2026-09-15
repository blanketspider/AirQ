/* AirAgain — interface, routing and rendering
   Part of the AirAgain air-quality monitor. */

let selectedCity = 'kathmandu';
let selectedCountry = 'nepal';
let compareCity = '';   // '' = no comparison
let selectedRange = 7;
let leafletMap = null, mapMarkers = {}, trendChart = null;
const $ = id => document.getElementById(id);

function go(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  $('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active', l.dataset.page===page));
  window.scrollTo({top:0,behavior:'smooth'});
  if(page==='home' && leafletMap) setTimeout(()=>leafletMap.invalidateSize(),220);
  // Charts sized while hidden render at 0px — redraw them once the page is visible.
  setTimeout(()=>{
    try{
      if(page==='forecast'){ renderForecast(); renderBacktest(); }
      if(page==='analysis'){ renderAnalysis(); renderLagAnalysis(); renderStats(); renderError(); renderRegression(); }
      if(page==='home' && trendChart) renderTrend();
    }catch(e){ console.error('page render:',e); }
  }, 60);
}

function gaugeSVG(aqi,color){
  const pct=Math.min(aqi,500)/500, rotation=pct*180-90, dash=pct*283;
  return `<div style="position:relative;width:12rem;height:6rem"><svg viewBox="0 0 200 100" style="width:100%;height:100%">
    <path d="M 10 90 A 90 90 0 0 1 190 90" fill="none" stroke="hsl(var(--muted))" stroke-width="20" stroke-linecap="round"/>
    <path d="M 10 90 A 90 90 0 0 1 190 90" fill="none" stroke="${color}" stroke-width="20" stroke-linecap="round" stroke-dasharray="${dash} 283"/>
    <line x1="100" y1="90" x2="100" y2="30" stroke="${color}" stroke-width="3" stroke-linecap="round" transform="rotate(${rotation} 100 90)"/>
    <circle cx="100" cy="90" r="5" fill="${color}"/></svg></div>`;
}

function renderDashboard(){
  const r = latest(selectedCity);
  const cityNm = r.city_name || CITIES.find(c=>c.slug===selectedCity).name;
  $('dash-city').innerHTML = cityNm + (r.isLive
    ? '<span class="live-badge"><span class="live-dot"></span>Live</span>'
    : '<span class="sample-badge">Sample</span>');
  $('reading-body').innerHTML = `
    <div class="gauge-wrap">${gaugeSVG(r.aqi,r.color)}
      <div style="text-align:center"><div class="gauge-value" style="color:${r.color}">${r.aqi}</div><div class="gauge-cat">${r.category}</div></div></div>
    <div class="advisory"><h3>Health advisory</h3><p>${r.health_advisory}</p></div>`;
  const subVals = Object.values(r.sub_indices).filter(v=>typeof v==='number');
  const maxSub = Math.max(...(subVals.length?subVals:[1]),1);
  $('breakdown').innerHTML = POLLUTANT_META.map(p=>{
    const val=r.sub_indices[p.key];
    if(val==null && r.isLive) return '';   // live station doesn't report this pollutant
    const v = val||0, raw=r[p.key], pct=(v/maxSub)*100, dom=p.key===r.dominant_pollutant;
    const rawTxt = (raw==null) ? '—' : (r.isLive ? `${raw}` : `${raw} ${p.unit}`);
    return `<div class="poll-row"><div class="poll-label"><span class="${dom?'dom':''}">${p.label}${dom?' · dominant':''}</span><span class="muted">${rawTxt}</span></div>
      <div class="poll-bar"><div class="poll-fill" style="width:${pct}%;background:${r.color}"></div></div></div>`;
  }).join('');
  const d = doodleFor(r.aqi);
  $('doodle-box').innerHTML = `${d.svg}<div class="doodle-caption">${d.caption}</div><div class="doodle-sub">${d.sub}</div>`;
  // today tip
  const tip = todayTip(r.aqi);
  $('today-tip').innerHTML = `<span class="tip-icon">${tip.icon}</span><span><b>What to do today:</b> ${tip.text}</span>`;
  // timestamp / provenance
  if(r.isLive){
    const when = r.updated ? new Date(r.updated.replace(' ','T')) : new Date();
    const whenTxt = isNaN(when) ? 'recently' : when.toLocaleString('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'});
    $('dash-updated').innerHTML = `Measured ${whenTxt} · station: ${r.station} · source: World Air Quality Index`;
  } else {
    $('dash-updated').textContent = `No live station available — showing representative sample data`;
  }
  // current pill
  const cat = categoryFor(r.aqi);
  $('current-pill').innerHTML = `<span class="dot" style="background:${cat.color}"></span> AQI ${r.aqi} · ${cat.label}`;
}

function renderCityList(){ /* replaced by selector + list combined below */ }

function citiesIn(country){ return CITIES.filter(c=>c.country===country); }
function populateSelect(){
  const list = citiesIn(selectedCountry);
  const opts = list.map(c=>`<option value="${c.slug}">${c.name}</option>`).join('');
  $('city-select').innerHTML = opts;
  $('city-select').value = selectedCity;
  // compare dropdown: "none" + all cities in the current country except the selected one
  $('compare-select').innerHTML = `<option value="">None</option>` +
    list.filter(c=>c.slug!==selectedCity).map(c=>`<option value="${c.slug}">${c.name}</option>`).join('');
  $('compare-select').value = compareCity;
  // per-page selectors (Forecast / Analysis) — all cities, both countries
  const allOpts = CITIES.map(c=>`<option value="${c.slug}">${c.name}${c.country==='india'?' (IN)':' (NP)'}</option>`).join('');
  ['fc-city-select','an-city-select'].forEach(id=>{
    const el = $(id); if(!el) return;
    el.innerHTML = allOpts;
    el.value = selectedCity;
  });
  const nm = cityName(selectedCity);
  if($('fc-city-label')) $('fc-city-label').textContent = nm;
  if($('an-city-label')) $('an-city-label').textContent = nm;
}

/* City list grid stays too (ranked) */
function cityName(slug){ return CITIES.find(c=>c.slug===slug).name; }

/* ---- Trend chart ---- */
function chartTheme(){
  const dark = document.body.classList.contains('dark');
  return { text: dark?'#e5e5e5':'#1a1a1a', grid: dark?'rgba(255,255,255,.09)':'rgba(0,0,0,.08)' };
}
function renderTrend(){
  const data = seriesFor(selectedCity, selectedRange);
  $('trend-title').textContent = compareCity
    ? `AQI trend — ${cityName(selectedCity)} vs ${cityName(compareCity)}`
    : `AQI trend — ${cityName(selectedCity)}`;
  const t = chartTheme();
  const labels = data.map(d=>d.date.toLocaleDateString('en-US',{month:'short',day:'numeric'}));
  const vals = data.map(d=>d.aqi);
  const ctx = $('trend-chart');
  if(!window.Chart){ ctx.parentElement.innerHTML = '<div class="muted" style="text-align:center;padding:2rem">Chart library did not load. Reconnect to the internet and refresh to see the graph.</div>'; return; }
  if(trendChart) trendChart.destroy();
  const datasets = [{
    label:cityName(selectedCity), data:vals, borderColor:'hsl(150,45%,45%)',
    backgroundColor:'hsla(150,45%,45%,.12)', fill:!compareCity, tension:.32, borderWidth:2,
    pointRadius:selectedRange<=7?4:2, pointBackgroundColor:vals.map(v=>categoryFor(v).color), pointBorderColor:'#fff', pointBorderWidth:1
  }];
  if(compareCity){
    const cdata = seriesFor(compareCity, selectedRange).map(d=>d.aqi);
    datasets.push({
      label:cityName(compareCity), data:cdata, borderColor:'hsl(220,70%,55%)',
      backgroundColor:'transparent', fill:false, tension:.32, borderWidth:2, borderDash:[5,4],
      pointRadius:selectedRange<=7?4:2, pointBackgroundColor:'hsl(220,70%,55%)', pointBorderColor:'#fff', pointBorderWidth:1
    });
  }
  trendChart = new Chart(ctx,{
    type:'line',
    data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:!!compareCity,labels:{color:t.text,usePointStyle:true,boxWidth:8}},tooltip:{callbacks:{afterLabel:c=>categoryFor(c.parsed.y).label}}},
      scales:{x:{ticks:{color:t.text,maxRotation:0,autoSkip:true,maxTicksLimit:selectedRange<=7?7:10},grid:{color:t.grid}},
              y:{ticks:{color:t.text},grid:{color:t.grid},beginAtZero:true}}}
  });
}

/* ---- Forecast panel ---- */
function renderForecast(){
  const fc = forecast(selectedCity, selectedRange, 3);
  $('forecast-grid').innerHTML = fc.points.map((p,i)=>{
    const cat = categoryFor(p.aqi);
    const dayLabel = i===0 ? 'Tomorrow' : p.date.toLocaleDateString('en-US',{weekday:'short'});
    return `<div class="forecast-card">
      <div class="forecast-day">${dayLabel}</div>
      <div class="forecast-aqi" style="color:${cat.color}">${p.aqi}</div>
      <div class="forecast-cat" style="color:${cat.color}">${cat.label}</div>
      <div class="forecast-range">range ${p.lo}–${p.hi}</div>
    </div>`;
  }).join('');
  const dir = fc.slope > 0.5 ? 'worsening' : (fc.slope < -0.5 ? 'improving' : 'roughly steady');
  $('forecast-note').innerHTML = `Trend is <b>${dir}</b> (${fc.slope>=0?'+':''}${fc.slope.toFixed(1)} AQI/day over the last ${selectedRange} days). The range shows the forecast's uncertainty band — wider means less certain.`;
}

/* ---- Backtest panel ---- */
let backtestChart = null;
function renderBacktest(){
  const bt = backtest(selectedCity, 7);   // 7-day trailing window, evaluated across the 30-day history
  const beats = bt.skill >= 0;
  $('backtest-grid').innerHTML = `
    <div class="backtest-card highlight">
      <div class="bt-label">Average error (MAE)</div>
      <div class="bt-value">±${bt.mMAE.toFixed(1)}</div>
      <div class="bt-sub">On average the forecast was off by this many AQI points.</div>
    </div>
    <div class="backtest-card">
      <div class="bt-label">RMSE</div>
      <div class="bt-value">${bt.mRMSE.toFixed(1)}</div>
      <div class="bt-sub">Root-mean-square error — penalises big misses more.</div>
    </div>
    <div class="backtest-card">
      <div class="bt-label">Naive baseline (MAE)</div>
      <div class="bt-value">±${bt.nMAE.toFixed(1)}</div>
      <div class="bt-sub">"Tomorrow = today." The bar the model must beat.</div>
    </div>
    <div class="backtest-card">
      <div class="bt-label">Skill vs baseline</div>
      <div class="bt-value" style="color:${beats?'hsl(140,40%,45%)':'hsl(0,75%,50%)'}">${bt.skill>=0?'+':''}${bt.skill.toFixed(0)}%</div>
      <div class="bt-sub">${beats?'Model beats the naive guess.':'Model does not beat the naive guess here.'}</div>
    </div>`;

  // predicted vs actual chart
  const t = chartTheme();
  const ctx = $('backtest-chart');
  if(window.Chart){
    if(backtestChart) backtestChart.destroy();
    const labels = bt.rows.map(r=>r.date.toLocaleDateString('en-US',{month:'short',day:'numeric'}));
    backtestChart = new Chart(ctx,{
      type:'line',
      data:{labels,datasets:[
        {label:'Actual', data:bt.rows.map(r=>r.actual), borderColor:'hsl(150,45%,45%)', backgroundColor:'transparent', borderWidth:2, tension:.3, pointRadius:2},
        {label:'Predicted', data:bt.rows.map(r=>r.pred), borderColor:'hsl(25,85%,55%)', backgroundColor:'transparent', borderWidth:2, borderDash:[5,4], tension:.3, pointRadius:2},
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,labels:{color:t.text,usePointStyle:true,boxWidth:8}}},
        scales:{x:{ticks:{color:t.text,maxRotation:0,autoSkip:true,maxTicksLimit:8},grid:{color:t.grid}},
                y:{ticks:{color:t.text},grid:{color:t.grid},beginAtZero:true}}}
    });
  }

  const verdict = beats
    ? `Over ${bt.n} tested days, the trend model beat the naive "tomorrow = today" guess by ${bt.skill.toFixed(0)}% on RMSE — a modest but real edge.`
    : `Over ${bt.n} tested days, the naive "tomorrow = today" guess was about as good as the model. That's common for short-term AQI, and it's why a baseline matters — a model is only useful if it beats one.`;
  $('backtest-note').innerHTML = `${verdict} <b>Note:</b> this validates the evaluation method on sample data; run it on a live feed and the same numbers become a real accuracy report.`;
}

/* ---- Dominant-pollutant analysis panel ---- */
function renderAnalysis(){
  const a = dominantAnalysis(selectedCity);
  const top = a.overall[0];
  const second = a.overall[1];
  // Plain-language summary
  let summary = `Over the past year in <b>${cityName(selectedCity)}</b>, `;
  summary += `<span class="amount">${pollLabel(top.key)}</span> was the dominant pollutant on <span class="amount">${top.pct.toFixed(0)}%</span> of days`;
  if(second) summary += `, and <b>${pollLabel(second.key)}</b> on <span class="amount">${second.pct.toFixed(0)}%</span>`;
  summary += `. `;
  // Seasonal contrast: compare winter vs pre-monsoon leaders
  const winLead = a.bySeason['winter'].items[0];
  const preLead = a.bySeason['pre-monsoon'].items[0];
  if(winLead && preLead && winLead.key !== preLead.key){
    summary += `This changes substantially by season: <b>${pollLabel(winLead.key)}</b> leads in winter (${winLead.pct.toFixed(0)}%), but <b>${pollLabel(preLead.key)}</b> takes over in the pre-monsoon dust season (${preLead.pct.toFixed(0)}%).`;
  } else {
    summary += `The dominant pollutant stays fairly consistent across seasons here.`;
  }
  $('analyze-summary').innerHTML = summary;

  // Season cards
  $('season-grid').innerHTML = SEASON_ORDER.map(s=>{
    const b = a.bySeason[s];
    const months = {winter:'Dec–Feb', 'pre-monsoon':'Mar–May', monsoon:'Jun–Sep', 'post-monsoon':'Oct–Nov'}[s];
    const bars = b.items.slice(0,3).map((it,i)=>{
      const isDust = it.key==='pm10';
      return `<div class="season-bar-row">
        <div class="season-bar-label"><span class="${i===0?'lead':''}">${pollLabel(it.key)}</span><span class="muted">${it.pct.toFixed(0)}%</span></div>
        <div class="season-bar-track"><div class="season-bar-fill ${isDust?'dust':''}" style="width:${it.pct.toFixed(0)}%"></div></div>
      </div>`;
    }).join('');
    return `<div class="season-card">
      <div class="season-name">${SEASON_LABEL[s]}</div>
      <div class="season-sub">${months} · ${b.n} days</div>
      ${bars}
    </div>`;
  }).join('');

  $('analyze-note').innerHTML = `Dominant pollutant = the one with the highest CPCB sub-index that day. The seasonal shift shown here (combustion-driven PM2.5 in winter vs. dust-driven PM10 in the dry pre-monsoon) mirrors real patterns across the region. <b>Note:</b> computed on a full year of representative sample data — the same analysis runs unchanged on a real historical feed.`;
}

/* ---- Cross-border lag analysis panel (fixed: Delhi → Kathmandu) ---- */
let lagChart = null;
function renderLagAnalysis(){
  const la = lagAnalysis('kathmandu', 'delhi', 7);
  const best = la.best;
  const improvement = best.r - la.sameDay;

  // Headline
  if(best.lag === 0){
    $('lag-headline').innerHTML = `<div class="lag-big">Strongest link: same day</div>
      <div class="lag-sub">In this data, ${la.downwind}'s AQI tracks ${la.upwind}'s most closely with no delay (correlation ${best.r.toFixed(2)}). No clear early-warning lead time emerges.</div>`;
  } else {
    $('lag-headline').innerHTML = `<div class="lag-big">${la.upwind} leads ${la.downwind} by ~${best.lag} day${best.lag>1?'s':''}</div>
      <div class="lag-sub">${la.downwind}'s air quality correlates most strongly with ${la.upwind}'s from <b>${best.lag} day${best.lag>1?'s':''} earlier</b> (correlation ${best.r.toFixed(2)}, vs ${la.sameDay.toFixed(2)} same-day). In other words, when ${la.upwind} worsens, ${la.downwind} tends to follow about ${best.lag} day${best.lag>1?'s':''} later — a potential early warning.</div>`;
  }

  // Bar cards per lag
  const maxR = Math.max(...la.results.map(x=>x.r), 0.01);
  $('lag-bars').innerHTML = la.results.map(x=>`
    <div class="lag-bar-card ${x.lag===best.lag?'peak':''}">
      <div class="lag-bar-day">${x.lag===0?'Same day':'+'+x.lag+'d'}</div>
      <div class="lag-bar-val" style="${x.lag===best.lag?'color:hsl(var(--primary))':''}">${x.r.toFixed(2)}</div>
      <div class="lag-bar-track"><div class="lag-bar-fill" style="width:${Math.max(0,x.r/maxR*100).toFixed(0)}%"></div></div>
    </div>`).join('');

  // Chart: correlation vs lag
  const t = chartTheme();
  const ctx = $('lag-chart');
  if(window.Chart){
    if(lagChart) lagChart.destroy();
    lagChart = new Chart(ctx,{
      type:'line',
      data:{ labels: la.results.map(x=>x.lag===0?'0 (same day)':x.lag+'d'),
        datasets:[{ label:'Correlation', data: la.results.map(x=>x.r),
          borderColor:'hsl(150,45%,45%)', backgroundColor:'hsla(150,45%,45%,.12)', fill:true,
          tension:.3, borderWidth:2, pointRadius: la.results.map(x=>x.lag===best.lag?6:3),
          pointBackgroundColor: la.results.map(x=>x.lag===best.lag?'hsl(150,45%,45%)':'#fff'),
          pointBorderColor:'hsl(150,45%,45%)', pointBorderWidth:2 }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{title:c=>`Delhi leads by ${c[0].label}`, label:c=>`correlation ${c.parsed.y.toFixed(3)}`}} },
        scales:{ x:{ title:{display:true,text:'Days Delhi leads Kathmandu',color:t.text}, ticks:{color:t.text}, grid:{color:t.grid} },
                 y:{ title:{display:true,text:'Correlation',color:t.text}, ticks:{color:t.text}, grid:{color:t.grid} } } }
    });
  }

  $('lag-note').innerHTML = `Method: Pearson correlation between the two cities' daily AQI at each day-offset (cross-correlation) — the standard way to detect a lead/lag relationship. The peak offset is the apparent lead time. <b>Important honesty note:</b> this is computed on <i>representative sample data</i> in which a Delhi→Kathmandu coupling was modelled, so the ~${best.lag}-day result <i>demonstrates the method</i> — it is not yet a claim about the real world. Run the same analysis on real historical AQI for both cities and it would reveal the genuine lead time (or show there isn't one).`;
}

/* ---- Statistics panel ---- */
function renderStats(){
  const data = seriesFor(selectedCity, selectedRange);
  const s = stats(data.map(d=>d.aqi));
  $('stats-period').textContent = `· last ${selectedRange} days (n=${s.n})`;
  const cards = [
    {label:'Mean', val:s.mean.toFixed(1), help:'Average AQI over the period.'},
    {label:'Median', val:s.median.toFixed(1), help:'Middle value — half the days were below this.'},
  ];
  $('stats-grid').innerHTML = cards.map(c=>`<div class="stat-card">
    <div class="stat-label">${c.label}</div>
    <div class="stat-value">${c.val}</div>
    <div class="stat-help">${c.help}</div></div>`).join('');
}

/* ---- Error analysis panel ---- */
function renderError(){
  const data = seriesFor(selectedCity, selectedRange);
  const s = stats(data.map(d=>d.aqi));
  const lo = s.mean - s.ci95, hi = s.mean + s.ci95;
  $('error-panel').innerHTML = `
    <div class="error-headline">
      <span class="big">${s.mean.toFixed(1)}</span>
      <span class="pm">± ${s.ci95.toFixed(1)} AQI</span>
    </div>
    <div class="error-ci">We can be about 95% confident the true average AQI for ${cityName(selectedCity)} over this period lies between <b>${lo.toFixed(1)}</b> and <b>${hi.toFixed(1)}</b>.</div>
    <div class="error-row">
      <span class="k">Sample size (n)</span><span class="v">${s.n} days</span>
      <span class="k">Standard deviation (s)</span><span class="v">${s.sd.toFixed(2)} AQI</span>
      <span class="k">Standard error of the mean (SEM)</span><span class="v">${s.sem.toFixed(2)} AQI</span>
      <span class="k">95% margin of error (1.96 × SEM)</span><span class="v">± ${s.ci95.toFixed(2)} AQI</span>
      <span class="k">Coefficient of variation (CV)</span><span class="v">${s.cv.toFixed(1)}%</span>
    </div>
    <details class="formula">
      <summary>Show the working</summary>
      <div class="fbody">
        <p style="margin:0 0 .6rem">The mean is computed from a finite sample of daily readings, so how much would it wobble if we sampled again? Two quantities capture that.</p>
        <div class="mono">SEM = s / √n = ${s.sd.toFixed(2)} / √${s.n} = ${s.sem.toFixed(2)}</div>
        <div class="mono" style="margin-top:.4rem">95% CI = x̄ ± 1.96 × SEM = ${s.mean.toFixed(1)} ± ${s.ci95.toFixed(1)}</div>
        <p style="margin:.7rem 0 0">The <b>standard error</b> shrinks as √n grows — more days of data give a sharper estimate of the true mean. The <b>coefficient of variation</b> (${s.cv.toFixed(1)}%) expresses the spread relative to the mean, so you can compare volatility between a clean city and a polluted one on equal footing. The 1.96 multiplier is the normal-distribution factor for 95% confidence.</p>
      </div>
    </details>`;
}

/* ---- Regression panel ---- */
let currentFit = null;
function updateRegPrediction(){
  if(!currentFit) return;
  const temp = parseFloat($('reg-temp').value);
  const hum  = parseFloat($('reg-hum').value);
  $('reg-temp-val').textContent = temp + ' °C';
  $('reg-hum-val').textContent  = hum + ' %';
  if(currentFit.linBeta){
    const v = clampAQI(predictLinear(currentFit.linBeta, temp, hum));
    const cat = categoryFor(v);
    $('reg-lin-val').textContent = v;
    $('reg-lin-val').style.color = cat.color;
    $('reg-lin-cat').textContent = cat.label;
    $('reg-lin-cat').style.color = cat.color;
  }
  if(currentFit.polyBeta){
    const v = clampAQI(predictPoly(currentFit.polyBeta, temp, hum));
    const cat = categoryFor(v);
    $('reg-poly-val').textContent = v;
    $('reg-poly-val').style.color = cat.color;
    $('reg-poly-cat').textContent = cat.label;
    $('reg-poly-cat').style.color = cat.color;
  }
}
function renderRegression(){
  currentFit = fitRegression(selectedCity, selectedRange);
  const f = currentFit;
  // Degree-2 poly has 6 coefficients; with few points it overfits. Flag it honestly.
  f.polyReliable = f.n >= 12;
  $('reg-lin-r2').textContent  = f.linBeta ? f.linR2.toFixed(3) : 'n/a';
  $('reg-poly-r2').textContent = f.polyBeta ? f.polyR2.toFixed(3) : 'n/a';
  const polyCard = $('reg-poly-card');
  let warn = polyCard.querySelector('.reg-warn');
  if(!f.polyReliable){
    if(!warn){ warn=document.createElement('div'); warn.className='reg-warn'; polyCard.appendChild(warn); }
    warn.textContent = `⚠ Only ${f.n} data points for 6 coefficients — the degree-2 fit overfits here. Switch to "Last month" for a meaningful polynomial.`;
  } else if(warn){ warn.remove(); }
  if(f.linBeta){
    const b=f.linBeta;
    const sign=(x)=>x>=0?'+ '+x.toFixed(2):'− '+Math.abs(x).toFixed(2);
    $('reg-lin-eq').textContent = `AQI ≈ ${b[0].toFixed(1)} ${sign(b[1])}·temp ${sign(b[2])}·hum`;
  } else $('reg-lin-eq').textContent = 'Not enough variation to fit.';
  $('reg-note').innerHTML = `Fit on a full year of <b>${cityName(selectedCity)}</b> data (n=${f.n} days), where temperature and humidity vary across seasons. ` +
    `Colder, more humid conditions tend toward higher AQI — the models learn that seasonal pattern.`;
  updateRegPrediction();
}

/* ---- Ranked city grid (kept, below stats via explore? -> put after selector) ---- */

/* ---- Map (hardened) ---- */
function initMap(){
  const el = $('map');
  if(typeof L === 'undefined'){
    el.innerHTML = '<div class="map-fallback">The map needs the Leaflet library, which did not load (you may be offline). Everything else works — reconnect and refresh to see the map.</div>';
    return;
  }
  try{
    const c0 = COUNTRIES[selectedCountry];
    leafletMap = L.map('map',{scrollWheelZoom:false}).setView(c0.center, c0.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:18}).addTo(leafletMap);
    CITIES.forEach(city=>{
      const r = latest(city.slug);
      const m = L.circleMarker([city.lat,city.lng],{radius:11,fillColor:r.color,color:'#fff',weight:2,fillOpacity:.9}).addTo(leafletMap);
      m.bindPopup(`<div style="text-align:center;font-family:sans-serif"><div style="font-weight:600">${city.name}</div><div style="font-size:1.2rem;font-weight:800;color:${r.color}">AQI ${r.aqi}</div><div style="font-size:.75rem;color:#666">${r.category}</div></div>`);
      m.on('click',()=>selectCity(city.slug,false));
      mapMarkers[city.slug]=m;
    });
    setTimeout(()=>leafletMap.invalidateSize(),300);
    window.addEventListener('resize',()=>{ if(leafletMap) leafletMap.invalidateSize(); });
  }catch(err){
    el.innerHTML = '<div class="map-fallback">Map failed to initialise. Everything else on the page still works.</div>';
    console.error('Map init error:',err);
  }
}
function recenterMap(){
  if(!leafletMap) return;
  const c = COUNTRIES[selectedCountry];
  leafletMap.setView(c.center, c.zoom, {animate:true});
}
function highlightMarker(){
  if(!leafletMap) return;
  const m = mapMarkers[selectedCity];
  if(m){ leafletMap.panTo(m.getLatLng(),{animate:true}); m.openPopup(); }
}

/* ---- Country switch ---- */
function switchCountry(country){
  if(country===selectedCountry) return;
  selectedCountry = country;
  compareCity = '';
  selectedCity = citiesIn(country)[0].slug;  // first city of that country
  document.querySelectorAll('.country-btn').forEach(b=>b.classList.toggle('active', b.dataset.country===country));
  populateSelect();
  renderDashboard();
  renderTrend();
  renderForecast();
  renderBacktest();
  renderAnalysis();
  renderStats();
  renderError();
  renderRegression();
  recenterMap();
  highlightMarker();
  try{ AABackend.refreshAlertBar(); }catch(e){}
}

/* ---- select a city (updates everything) ---- */
function selectCity(slug, scroll=true){
  const city = CITIES.find(c=>c.slug===slug);
  // if the picked city is in the other country (e.g. via search), switch country too
  if(city.country !== selectedCountry){
    selectedCountry = city.country;
    compareCity = '';
    document.querySelectorAll('.country-btn').forEach(b=>b.classList.toggle('active', b.dataset.country===selectedCountry));
    recenterMap();
  }
  selectedCity = slug;
  // if compare == new selection, clear it
  if(compareCity === slug) compareCity = '';
  populateSelect();
  renderDashboard();
  renderTrend();
  renderForecast();
  renderBacktest();
  renderAnalysis();
  renderStats();
  renderError();
  renderRegression();
  highlightMarker();
  hideSearch();
  $('city-search').value='';
  try{ AABackend.refreshAlertBar(); }catch(e){}
  if(scroll && $('page-home').classList.contains('active')) $('dash-card').scrollIntoView({behavior:'smooth',block:'center'});
}
function setCompare(slug){
  compareCity = slug;
  renderTrend();
}

/* ---- Search ---- */
let hlIndex=-1;
function runSearch(q){
  const box=$('search-results'), query=q.trim().toLowerCase();
  if(!query){ hideSearch(); return; }
  const matches = CITIES.filter(c=>c.name.toLowerCase().includes(query)).slice(0,6);
  if(!matches.length){ box.innerHTML=`<div class="search-item muted" style="cursor:default">No matching city</div>`; box.classList.remove('hidden'); return; }
  hlIndex=-1;
  box.innerHTML = matches.map(c=>{ const r=latest(c.slug);
    return `<div class="search-item" data-slug="${c.slug}" onclick="selectCity('${c.slug}')"><span><span class="dot" style="background:${r.color}"></span>${c.name}</span><span style="font-weight:700;color:${r.color}">${r.aqi}</span></div>`;
  }).join('');
  box.classList.remove('hidden');
}
function hideSearch(){ $('search-results').classList.add('hidden'); }
function searchKeys(e){
  const items=[...document.querySelectorAll('#search-results .search-item[data-slug]')];
  if(!items.length) return;
  if(e.key==='ArrowDown'){e.preventDefault();hlIndex=(hlIndex+1)%items.length;}
  else if(e.key==='ArrowUp'){e.preventDefault();hlIndex=(hlIndex-1+items.length)%items.length;}
  else if(e.key==='Enter'){e.preventDefault();const t=items[hlIndex]||items[0];if(t)selectCity(t.dataset.slug);return;}
  else return;
  items.forEach((it,i)=>it.classList.toggle('hl',i===hlIndex));
}

/* ---- Explore ---- */
const EXPLORE=[
  {page:'forecast',title:'See the forecast',desc:'Where AQI is heading next, and how accurate our predictions actually are.',icon:'<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>'},
  {page:'analysis',title:'Dig into the data',desc:'Seasonal patterns, statistics, and the cross-border early-warning study.',icon:'<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8"/><rect x="12" y="6" width="3" height="12"/><rect x="17" y="13" width="3" height="5"/>'},
  {page:'advisory',title:'Health advice',desc:'What each AQI level means for you, and how to stay safe.',icon:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>'},
  {page:'pollutants',title:'Why pollution rises',desc:'The five pollutants, their sources, and why winter is worst.',icon:'<path d="M17.5 19a4.5 4.5 0 1 0 0-9H12"/><path d="M9.5 5a3.5 3.5 0 1 1 0 7H2"/><path d="M12.5 15a3 3 0 1 0 0 6H4"/>'},
  {page:'about',title:'How AQI works',desc:'The CPCB method and the math behind the number.',icon:'<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'},
  {page:'advisory',title:'Protect your family',desc:'Extra care for children, older adults, and sensitive groups.',icon:'<circle cx="9" cy="7" r="3"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="8" r="2.5"/><path d="M20.5 20a5 5 0 0 0-5-4"/>'},
];
function renderExplore(){
  $('explore-grid').innerHTML = EXPLORE.map(e=>`<button class="explore-card" onclick="go('${e.page}')">
    <div class="explore-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${e.icon}</svg></div>
    <h4>${e.title}</h4><p>${e.desc}</p><span class="arrow">Read more →</span></button>`).join('');
}
function renderAdvisoryBands(){
  $('advisory-bands').innerHTML = CATEGORIES.map((c,i)=>{const lo=i===0?0:CATEGORIES[i-1].max+1;
    return `<div class="advisory-band"><div class="ab-badge" style="background:${c.color}"></div><div><div class="ab-title">${c.label} <span class="ab-range">· AQI ${lo}–${c.max}</span></div><p>${c.advisory}</p></div></div>`;}).join('');
}
function renderAboutLegend(){
  $('about-legend').innerHTML = CATEGORIES.map((c,i)=>{const lo=i===0?0:CATEGORIES[i-1].max+1;
    return `<div class="advisory-band"><div class="ab-badge" style="background:${c.color}"></div><div><div class="ab-title">${c.label} <span class="ab-range">· ${lo}–${c.max}</span></div></div></div>`;}).join('');
}

/* ---- Theme (independent of map/CDN) ---- */
function applyThemeIcon(dark){
  $('theme-icon').innerHTML = dark
    ? '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
    : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>';
}
function toggleTheme(){
  const dark = document.body.classList.toggle('dark');
  try{ localStorage.setItem('airwatch_theme', dark?'dark':'light'); }catch(e){}
  applyThemeIcon(dark);
  if(trendChart) renderTrend();  // recolor axes
  if(backtestChart) renderBacktest();
  if(lagChart) renderLagAnalysis();
}

/* ---- Range toggle ---- */
function setRange(days){
  selectedRange = days;
  document.querySelectorAll('.range-btn').forEach(b=>b.classList.toggle('active', +b.dataset.range===days));
  renderTrend(); renderForecast(); renderBacktest(); renderStats(); renderError(); renderRegression();
}

/* ---- INIT (UI wired FIRST, map LAST and guarded) ---- */
function init(){
  buildHistory();

  // theme first, from storage
  let darkPref=false;
  try{ darkPref = localStorage.getItem('airwatch_theme')==='dark'; }catch(e){}
  if(darkPref) document.body.classList.add('dark');
  applyThemeIcon(darkPref);

  populateSelect();
  renderDashboard();
  renderTrend();
  renderForecast();
  renderBacktest();
  renderAnalysis();
  renderLagAnalysis();
  renderStats();
  renderError();
  renderRegression();
  renderExplore();
  renderAdvisoryBands();
  renderAboutLegend();

  // wire controls (never blocked by map)
  $('theme-toggle').addEventListener('click', toggleTheme);
  $('reg-temp').addEventListener('input', updateRegPrediction);
  $('reg-hum').addEventListener('input', updateRegPrediction);
  $('city-select').addEventListener('change', e=>selectCity(e.target.value,false));
  ['fc-city-select','an-city-select'].forEach(id=>{
    const el = $(id); if(el) el.addEventListener('change', e=>selectCity(e.target.value,false));
  });
  $('compare-select').addEventListener('change', e=>setCompare(e.target.value));
  document.querySelectorAll('.country-btn').forEach(b=>b.addEventListener('click',()=>switchCountry(b.dataset.country)));
  document.querySelectorAll('.range-btn').forEach(b=>b.addEventListener('click',()=>setRange(+b.dataset.range)));
  const si=$('city-search');
  si.addEventListener('input',e=>runSearch(e.target.value));
  si.addEventListener('keydown',searchKeys);
  si.addEventListener('focus',e=>{ if(e.target.value) runSearch(e.target.value); });
  document.addEventListener('click',e=>{ if(!e.target.closest('.search-wrap')) hideSearch(); });

  // map last, fully guarded so failure can't break anything above
  try{ initMap(); }catch(err){ console.error('initMap threw:',err); }

  // fetch live air-quality data (async, non-blocking — page works without it)
  try{ loadLiveData(); }catch(err){ console.error('live data:',err); }

  // backend (auth + alerts + feedback) — guarded so it never breaks the app
  try{ AABackend.init(); }catch(err){ console.error('backend init:',err); }
}

/* ============================================================
   BACKEND INTEGRATION (Supabase): login, alert opt-in, feedback
   Guarded throughout — if Supabase is unreachable, the rest of the
   app keeps working exactly as before.
   ============================================================ */