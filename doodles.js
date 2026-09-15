/* AirAgain — AQI-reactive illustrations
   Part of the AirAgain air-quality monitor. */

function doodleFor(aqi){
  const skin='#F1C9A5', hair='#4A3B2A';
  if(aqi<=100){
    return {caption:'Great day for a walk 🐕', sub:'Air is clean — enjoy the outdoors, no mask needed.',
      svg:`<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Walking a dog on a clear day">
        <circle cx="158" cy="42" r="18" fill="hsl(45,90%,60%)"/>
        ${[...Array(8)].map((_,i)=>{const a=i*45*Math.PI/180;return `<line x1="${(158+Math.cos(a)*24).toFixed(1)}" y1="${(42+Math.sin(a)*24).toFixed(1)}" x2="${(158+Math.cos(a)*32).toFixed(1)}" y2="${(42+Math.sin(a)*32).toFixed(1)}" stroke="hsl(45,90%,55%)" stroke-width="3" stroke-linecap="round"/>`}).join('')}
        <line x1="20" y1="165" x2="180" y2="165" stroke="hsl(140,40%,45%)" stroke-width="3" stroke-linecap="round"/>
        <circle cx="78" cy="60" r="14" fill="${skin}"/><path d="M64 56 a14 14 0 0 1 28 0 z" fill="${hair}"/>
        <rect x="70" y="74" width="16" height="34" rx="7" fill="hsl(150,40%,45%)"/>
        <line x1="78" y1="82" x2="60" y2="96" stroke="${skin}" stroke-width="6" stroke-linecap="round"/>
        <line x1="78" y1="82" x2="96" y2="98" stroke="${skin}" stroke-width="6" stroke-linecap="round"/>
        <line x1="74" y1="108" x2="66" y2="150" stroke="${hair}" stroke-width="7" stroke-linecap="round"/>
        <line x1="82" y1="108" x2="92" y2="150" stroke="${hair}" stroke-width="7" stroke-linecap="round"/>
        <path d="M96 98 Q120 110 132 128" fill="none" stroke="hsl(220,10%,55%)" stroke-width="2"/>
        <ellipse cx="150" cy="135" rx="22" ry="13" fill="${hair}"/><circle cx="170" cy="126" r="9" fill="${hair}"/>
        <path d="M176 120 l4 -8 l3 8 z" fill="${hair}"/>
        <line x1="140" y1="146" x2="140" y2="158" stroke="${hair}" stroke-width="4" stroke-linecap="round"/>
        <line x1="160" y1="146" x2="160" y2="158" stroke="${hair}" stroke-width="4" stroke-linecap="round"/>
        <path d="M128 132 q-8 -6 -4 -14" fill="none" stroke="${hair}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="173" cy="125" r="1.5" fill="#fff"/></svg>`};
  } else if(aqi<=200){
    return {caption:'Take it a little easy today', sub:'Sensitive groups may feel it — ease up on hard outdoor exertion.',
      svg:`<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Person with a light mask">
        <line x1="20" y1="170" x2="180" y2="170" stroke="hsl(45,60%,55%)" stroke-width="3" stroke-linecap="round"/>
        ${[...Array(3)].map((_,i)=>`<path d="M${40+i*50} 40 q10 -8 20 0 t20 0" fill="none" stroke="hsl(45,40%,70%)" stroke-width="3" stroke-linecap="round"/>`).join('')}
        <circle cx="100" cy="72" r="26" fill="${skin}"/><path d="M74 68 a26 26 0 0 1 52 0 z" fill="${hair}"/>
        <path d="M82 78 q18 14 36 0 l0 10 q-18 12 -36 0 z" fill="hsl(200,50%,85%)" stroke="hsl(200,40%,60%)" stroke-width="1.5"/>
        <line x1="82" y1="80" x2="72" y2="76" stroke="hsl(200,40%,60%)" stroke-width="1.5"/>
        <line x1="118" y1="80" x2="128" y2="76" stroke="hsl(200,40%,60%)" stroke-width="1.5"/>
        <circle cx="90" cy="70" r="2.5" fill="${hair}"/><circle cx="110" cy="70" r="2.5" fill="${hair}"/>
        <rect x="84" y="100" width="32" height="44" rx="10" fill="hsl(45,80%,55%)"/>
        <line x1="100" y1="112" x2="76" y2="128" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>
        <line x1="100" y1="112" x2="124" y2="128" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>
        <line x1="92" y1="144" x2="88" y2="182" stroke="${hair}" stroke-width="8" stroke-linecap="round"/>
        <line x1="108" y1="144" x2="112" y2="182" stroke="${hair}" stroke-width="8" stroke-linecap="round"/></svg>`};
  } else {
    const hz = aqi<=300 ? 'hsl(25,60%,60%)' : (aqi<=400 ? 'hsl(0,55%,60%)' : 'hsl(350,40%,45%)');
    const parts=[[30,40,3],[60,30,2],[90,55,3.5],[120,35,2.5],[150,60,3],[175,45,2],[40,90,2.5],[80,110,3],[110,95,2],[140,120,3.5],[170,100,2.5],[55,140,2],[100,150,3],[130,60,2]];
    return {caption:aqi<=300?'Mask up before you head out 😷':'Best to stay indoors today',
      sub:aqi<=300?'Wear a sealed N95/KN95 and limit time outside.':'Air is hazardous — avoid outdoor activity and keep windows closed.',
      svg:`<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Person wearing an N95 in heavy haze">
        ${parts.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${hz}" opacity="0.45"/>`).join('')}
        <line x1="20" y1="172" x2="180" y2="172" stroke="${hz}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="100" cy="72" r="26" fill="${skin}"/><path d="M74 68 a26 26 0 0 1 52 0 z" fill="${hair}"/>
        <path d="M78 74 q22 20 44 0 l2 14 q-24 16 -48 0 z" fill="#fff" stroke="hsl(220,10%,55%)" stroke-width="2"/>
        <path d="M78 82 q22 8 44 0" fill="none" stroke="hsl(220,10%,70%)" stroke-width="1.5"/>
        <path d="M78 88 q22 8 44 0" fill="none" stroke="hsl(220,10%,70%)" stroke-width="1.5"/>
        <line x1="78" y1="76" x2="66" y2="70" stroke="hsl(220,10%,55%)" stroke-width="2"/>
        <line x1="122" y1="76" x2="134" y2="70" stroke="hsl(220,10%,55%)" stroke-width="2"/>
        <circle cx="90" cy="68" r="2.5" fill="${hair}"/><circle cx="110" cy="68" r="2.5" fill="${hair}"/>
        <path d="M88 60 q4 -4 8 0" fill="none" stroke="${hair}" stroke-width="2" stroke-linecap="round"/>
        <path d="M104 60 q4 -4 8 0" fill="none" stroke="${hair}" stroke-width="2" stroke-linecap="round"/>
        <rect x="84" y="100" width="32" height="44" rx="10" fill="${hz}"/>
        <line x1="100" y1="112" x2="78" y2="126" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>
        <line x1="100" y1="112" x2="122" y2="126" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>
        <line x1="92" y1="144" x2="88" y2="182" stroke="${hair}" stroke-width="8" stroke-linecap="round"/>
        <line x1="108" y1="144" x2="112" y2="182" stroke="${hair}" stroke-width="8" stroke-linecap="round"/></svg>`};
  }
}

/* ============================================================
   UI STATE
   ============================================================ */