/* Only local time is read from the host. Radio/battery/flight are simulation. */
(function () {
  const bar=document.getElementById('device-status');
  if(!bar) return;
  const clock=bar.querySelector('time');
  const cell=[...bar.querySelectorAll('.status-cellular rect')];
  const wifi=[...bar.querySelectorAll('.status-wifi path')];
  const battery=bar.querySelector('.status-battery-value');
  const phone=matchMedia('(max-width: 540px)');
  const state={level:82,charging:false,wifi:3,signal:4,airplane:false};
  const range=(low,high)=>low+Math.random()*(high-low);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  let active=false,timer=0,updates=0,phase='normal',nextKind='charging';
  let nextSignal=0,nextBattery=0,nextEvent=0,lastSignature;
  function labels(time) {
    const code=(document.documentElement.lang||'en').slice(0,2);
    const packs={
      zh:()=>`本机时间 ${time}；模拟状态：电池 ${state.level}%${state.charging?'，充电中':''}；${state.airplane?'飞行模式':`蜂窝 ${state.signal}/4，Wi-Fi ${state.wifi}/3`}`,
      en:()=>`Local time ${time}; simulated status: battery ${state.level}%${state.charging?', charging':''}; ${state.airplane?'airplane mode':`cellular ${state.signal}/4, Wi-Fi ${state.wifi}/3`}`,
      ja:()=>`現地時刻 ${time}；模擬状態：バッテリー ${state.level}%${state.charging?'、充電中':''}；${state.airplane?'機内モード':`電波 ${state.signal}/4、Wi-Fi ${state.wifi}/3`}`,
      es:()=>`Hora local ${time}; estado simulado: batería ${state.level}%${state.charging?', cargando':''}; ${state.airplane?'modo avión':`señal ${state.signal}/4, Wi-Fi ${state.wifi}/3`}`,
      ko:()=>`현재 시각 ${time}; 모의 상태: 배터리 ${state.level}%${state.charging?', 충전 중':''}; ${state.airplane?'비행기 모드':`신호 ${state.signal}/4, Wi-Fi ${state.wifi}/3`}`,
    };
    return (packs[code]||packs.en)();
  }
  function render() {
    const now=new Date();
    const time=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
    const signature=[time,document.documentElement.lang,...Object.values(state)].join('|');
    if(signature===lastSignature) return;
    lastSignature=signature;updates++;
    clock.textContent=time;
    clock.dateTime=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const label=labels(time);bar.setAttribute('aria-label',label);bar.title=label;
    bar.classList.toggle('is-airplane',state.airplane);
    bar.classList.toggle('is-charging',state.charging);
    bar.classList.toggle('is-low-battery',state.level<=20);
    bar.style.setProperty('--battery-level',state.level/100);
    battery.textContent=state.level;
    cell.forEach((element,index)=>element.style.opacity=index<state.signal?'1':'.22');
    wifi.forEach((element,index)=>element.style.opacity=(3-index)<=state.wifi?'1':'.2');
  }
  function resetDeadlines(now) {
    nextSignal=now+range(14000,22000);
    nextBattery=now+range(50000,70000);
    nextEvent=now+range(90000,150000);
    // A suspended demo resumes connected instead of replaying missed episodes.
    phase='normal';state.airplane=false;state.charging=false;
    state.wifi=Math.max(2,state.wifi);state.signal=Math.max(3,state.signal);
  }
  function schedule() {
    clearTimeout(timer);timer=0;
    if(!active) return;
    const now=Date.now(),minute=now+60000-now%60000;
    timer=setTimeout(tick,Math.max(30,Math.min(minute,nextSignal,nextBattery,nextEvent)-now+5));
  }
  function tick() {
    timer=0;if(!active) return;
    const now=Date.now();
    if(now>=nextSignal){
      if(!state.airplane){
        state.wifi=clamp(state.wifi+(Math.random()<.5?-1:1),1,3);
        state.signal=clamp(state.signal+(Math.random()<.4?-1:1),2,4);
      }
      nextSignal=now+range(14000,22000);
    }
    if(now>=nextBattery){
      state.level=clamp(state.level+(state.charging?1:-1),18,96);
      nextBattery=now+range(50000,70000);
    }
    if(now>=nextEvent){
      if(phase==='normal'){
        phase=nextKind;
        state.airplane=phase==='airplane';state.charging=phase==='charging';
        if(state.airplane){state.signal=0;state.wifi=0;}
        nextEvent=now+(state.airplane?range(8000,12000):range(45000,75000));
      }else{
        nextKind=phase==='charging'?'airplane':'charging';
        phase='normal';state.airplane=false;state.charging=false;state.wifi=3;state.signal=4;
        nextEvent=now+range(150000,240000);
      }
    }
    render();schedule();
  }
  function stop() {active=false;clearTimeout(timer);timer=0;}
  function reconcile() {
    const desktop=window.LT_SHELL?!window.LT_SHELL.isRealPhone():!phone.matches;
    bar.hidden=!desktop;
    if(!desktop||document.hidden){stop();return;}
    if(!active){active=true;resetDeadlines(Date.now());render();schedule();}
  }
  document.addEventListener('visibilitychange',reconcile);
  document.addEventListener('lt-i18n-applied',()=>{if(active) render();});
  phone.addEventListener('change',reconcile);
  new MutationObserver(reconcile).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',reconcile);
  window.LT_STATUS={getState:()=>({...state,phase,active,updates,timers:timer?1:0,clock:clock.textContent,nextEventAt:nextEvent})};
  reconcile();
})();
