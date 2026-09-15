/* AirAgain — Supabase backend: login, alert opt-in, feedback
   Part of the AirAgain air-quality monitor. */

const AABackend = (() => {
  let sb = null, user = null, mySubs = [];

  function ready(){ return !!sb; }

  async function init(){
    if(!window.supabase || !window.AIRAGAIN_SUPABASE_URL || window.AIRAGAIN_SUPABASE_URL.includes('PASTE')){
      // Not configured yet — hide backend UI gracefully.
      const el = $('alert-optin'); if(el) el.style.display='none';
      return;
    }
    sb = window.supabase.createClient(window.AIRAGAIN_SUPABASE_URL, window.AIRAGAIN_SUPABASE_ANON);

    // wire buttons
    $('auth-btn').addEventListener('click', onAuthClick);
    $('alert-toggle-btn').addEventListener('click', onAlertToggle);
    $('feedback-send').addEventListener('click', onFeedbackSend);

    // restore session + listen for changes
    const { data:{ session } } = await sb.auth.getSession();
    user = session?.user ?? null;
    sb.auth.onAuthStateChange((_e, s)=>{ user = s?.user ?? null; refreshAuthUI(); loadSubs(); });
    await loadSubs();
    refreshAuthUI();
    refreshAlertBar();
  }

  function refreshAuthUI(){
    const b = $('auth-btn');
    if(user){ b.textContent = (user.email||'Account').split('@')[0]; b.classList.add('signed-in'); b.title = user.email+' — click to sign out'; }
    else { b.textContent = 'Sign in'; b.classList.remove('signed-in'); b.title = 'Sign in with Google'; }
  }

  async function onAuthClick(){
    if(user){ if(confirm('Sign out?')){ await sb.auth.signOut(); user=null; mySubs=[]; refreshAuthUI(); refreshAlertBar(); } }
    else {
      const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin+location.pathname }});
      if(error) alert('Sign-in failed: '+error.message);
    }
  }

  async function loadSubs(){
    if(!user){ mySubs=[]; return; }
    const { data } = await sb.from('alert_subscriptions').select('city_slug,threshold,active').eq('user_id',user.id).eq('active',true);
    mySubs = data||[];
  }

  function subFor(slug){ return mySubs.find(s=>s.city_slug===slug); }

  // called by selectCity/switchCountry to keep the alert bar in sync
  function refreshAlertBar(){
    const el = $('alert-optin'); if(!el || el.style.display==='none') return;
    const name = cityName(selectedCity);
    $('alert-city-name').textContent = name;
    const sub = subFor(selectedCity);
    const controls = $('alert-optin-controls');
    const btn = $('alert-toggle-btn');
    if(!user){
      $('alert-optin-sub').innerHTML = `Sign in to set up alerts for <b>${name}</b>.`;
      controls.style.display='none';
      el.classList.remove('is-on');
    } else if(sub){
      $('alert-optin-sub').innerHTML = `You'll be emailed when <b>${name}</b> goes above AQI ${sub.threshold}.`;
      controls.style.display='flex';
      $('alert-threshold').value = String(sub.threshold);
      btn.textContent = 'Turn off';
      el.classList.add('is-on');
    } else {
      $('alert-optin-sub').innerHTML = `Choose a level and get emailed when <b>${name}</b> crosses it.`;
      controls.style.display='flex';
      btn.textContent = 'Notify me';
      el.classList.remove('is-on');
    }
  }

  async function onAlertToggle(){
    if(!user){ onAuthClick(); return; }
    const slug = selectedCity, name = cityName(selectedCity);
    const existing = subFor(slug);
    const btn = $('alert-toggle-btn');
    btn.disabled = true;
    try{
      if(existing){
        await sb.from('alert_subscriptions').update({active:false}).eq('user_id',user.id).eq('city_slug',slug);
      } else {
        const threshold = parseInt($('alert-threshold').value,10);
        await sb.from('alert_subscriptions').upsert({
          user_id:user.id, email:user.email, city_slug:slug, city_name:name,
          threshold, active:true, opted_in_at:new Date().toISOString()
        }, { onConflict:'user_id,city_slug' });
      }
      await loadSubs(); refreshAlertBar();
    }catch(err){ alert('Could not update alert: '+err.message); }
    finally{ btn.disabled = false; }
  }

  async function onFeedbackSend(){
    const msg = $('feedback-msg').value.trim();
    const status = $('feedback-status');
    if(!msg){ status.textContent='Please write something first.'; status.className='feedback-status err'; return; }
    if(!ready()){ status.textContent='Feedback is not connected yet.'; status.className='feedback-status err'; return; }
    $('feedback-send').disabled = true;
    try{
      const { error } = await sb.from('feedback').insert({
        message: msg, name: $('feedback-name').value.trim()||null, email: user?.email||null
      });
      if(error) throw error;
      $('feedback-msg').value=''; $('feedback-name').value='';
      status.textContent='Thank you — your feedback was sent.'; status.className='feedback-status ok';
    }catch(err){ status.textContent='Could not send: '+err.message; status.className='feedback-status err'; }
    finally{ $('feedback-send').disabled=false; }
  }

  return { init, refreshAlertBar };
})();
document.addEventListener('DOMContentLoaded', init);