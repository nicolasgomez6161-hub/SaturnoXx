/* ============================================================
   SaturnoX — app.js v4  (Enhanced)
   ============================================================ */
const DB = {
  getUsers()        { return JSON.parse(localStorage.getItem('sx_users')||'[]'); },
  saveUsers(u)      { localStorage.setItem('sx_users',JSON.stringify(u)); },
  getCurrentUser()  { return JSON.parse(localStorage.getItem('sx_current')||'null'); },
  setCurrentUser(u) { localStorage.setItem('sx_current',JSON.stringify(u)); },
  logout()          { localStorage.removeItem('sx_current'); },

  registerUser(data) {
    const users = this.getUsers();
    if (users.find(u=>u.email===data.email)) return {ok:false,msg:'Ya existe una cuenta con ese email.'};
    const user = {id:Date.now(),...data,createdAt:new Date().toISOString()};
    users.push(user); this.saveUsers(users);
    return {ok:true,user};
  },
  loginUser(email,pass) {
    const user = this.getUsers().find(u=>u.email===email&&u.password===pass);
    return user ? {ok:true,user} : {ok:false,msg:'Email o contraseña incorrectos.'};
  },
  updateUser(id,data) {
    const users=this.getUsers(), idx=users.findIndex(u=>u.id===id);
    if(idx<0)return;
    users[idx]={...users[idx],...data};
    this.saveUsers(users);
    if(this.getCurrentUser()?.id===id) this.setCurrentUser(users[idx]);
  },

  getBusinesses()   { 
    const stored = localStorage.getItem('sx_businesses');
    if (stored === null) { localStorage.setItem('sx_businesses','[]'); return []; }
    return JSON.parse(stored);
  },
  saveBusiness(biz) {
    const list=this.getBusinesses(), idx=list.findIndex(b=>b.id===biz.id);
    if(idx>=0)list[idx]=biz; else list.push(biz);
    localStorage.setItem('sx_businesses',JSON.stringify(list));
  },
  deleteBusiness(id) {
    localStorage.setItem('sx_businesses',JSON.stringify(this.getBusinesses().filter(b=>b.id!==id)));
    localStorage.setItem('sx_appointments',JSON.stringify(this.getAppointments().filter(a=>a.bizId!==id)));
  },
  getMyBusiness(ownerId){ return this.getBusinesses().find(b=>b.ownerId===ownerId)||null; },
  _initEmpty(){ localStorage.setItem('sx_businesses','[]'); return []; },

  getAppointments()     { return JSON.parse(localStorage.getItem('sx_appointments')||'[]'); },
  saveAppointment(appt) {
    const l=this.getAppointments(),i=l.findIndex(a=>a.id===appt.id);
    if(i>=0)l[i]=appt; else l.push(appt);
    localStorage.setItem('sx_appointments',JSON.stringify(l));
  },
  updateApptStatus(id,status,extra={}) {
    const l=this.getAppointments(),i=l.findIndex(a=>a.id===id);
    if(i>=0){ Object.assign(l[i],{status,updatedAt:new Date().toISOString(),...extra}); localStorage.setItem('sx_appointments',JSON.stringify(l)); }
  },
  cancelByUser(id) {
    this.updateApptStatus(id,'cancelled',{cancelledBy:'user',cancelledAt:new Date().toISOString(),notifiedBiz:false});
  },
  cancelByBusiness(id,reason='') {
    this.updateApptStatus(id,'cancelled_by_business',{
      cancelledBy:'business', cancelledAt:new Date().toISOString(),
      cancelReason:reason, notified:false
    });
  },
  markNotified(id) {
    const l=this.getAppointments(),i=l.findIndex(a=>a.id===id);
    if(i>=0){ l[i].notified=true; localStorage.setItem('sx_appointments',JSON.stringify(l)); }
  },
  markAllNotified(uid) {
    const l=this.getAppointments();
    l.forEach(a=>{ if(a.userId===uid && a.cancelledBy==='business' && !a.notified) a.notified=true; });
    localStorage.setItem('sx_appointments',JSON.stringify(l));
  },
  getUserAppointments(uid){ return this.getAppointments().filter(a=>a.userId===uid); },
  getBizAppointments(bid) { return this.getAppointments().filter(a=>a.bizId===bid); },
  getActiveAppts(bid)     { return this.getBizAppointments(bid).filter(a=>!a.status.startsWith('cancel')); },
  isTaken(bizId,date,time) {
    const biz = this.getBusinesses().find(b=>b.id===bizId);
    const capacity = (biz && biz.slotCapacity && biz.slotCapacity > 1) ? biz.slotCapacity : 1;
    return this.getSlotCount(bizId,date,time) >= capacity;
  },
  getSlotCount(bizId,date,time) {
    return this.getAppointments().filter(a=>
      a.bizId===bizId && a.date===date && a.time===time && !a.status.startsWith('cancel')
    ).length;
  },
  getSlotRemaining(bizId,date,time) {
    const biz = this.getBusinesses().find(b=>b.id===bizId);
    const capacity = (biz && biz.slotCapacity && biz.slotCapacity > 1) ? biz.slotCapacity : 1;
    const used = this.getSlotCount(bizId,date,time);
    return Math.max(0, capacity - used);
  },
  getPendingNotifs(uid) {
    return this.getAppointments().filter(a=>
      a.userId===uid && a.cancelledBy==='business' && a.notified===false
    );
  },
  getPendingBizNotifs(bizId) {
    return this.getAppointments().filter(a=>
      a.bizId===bizId && a.cancelledBy==='user' && a.notifiedBiz===false
    );
  },
  markBizNotified(bizId) {
    const l=this.getAppointments();
    l.forEach(a=>{ if(a.bizId===bizId && a.cancelledBy==='user' && a.notifiedBiz===false) a.notifiedBiz=true; });
    localStorage.setItem('sx_appointments',JSON.stringify(l));
  },
  getStats(bizId) {
    const all=this.getBizAppointments(bizId);
    const active=all.filter(a=>!a.status.startsWith('cancel'));
    const cancelled=all.filter(a=>a.status.startsWith('cancel'));
    const cancelByBiz=all.filter(a=>a.cancelledBy==='business');
    const today=new Date().toLocaleDateString('es-AR');
    const byDay={},byHour={};
    active.forEach(a=>{ byDay[a.date]=(byDay[a.date]||0)+1; const h=a.time?.split(':')[0]; if(h)byHour[h]=(byHour[h]||0)+1; });
    return {
      total:all.length, active:active.length,
      cancelled:cancelled.length, cancelledByBiz:cancelByBiz.length,
      today:active.filter(a=>a.date===today).length,
      clients:[...new Set(active.map(a=>a.userId))].length,
      cancelRate:all.length?Math.round(cancelled.length/all.length*100):0,
      topDays:Object.entries(byDay).sort((a,b)=>b[1]-a[1]).slice(0,7),
      topHours:Object.entries(byHour).sort((a,b)=>b[1]-a[1]).slice(0,5),
    };
  },
  generateSlots(start,end,interval=30) {
    const s=[]; let [sh,sm]=start.split(':').map(Number); const [eh,em]=end.split(':').map(Number);
    while(sh*60+sm<eh*60+em){ s.push(`${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`); sm+=interval; while(sm>=60){sm-=60;sh++;} }
    return s;
  },
  isCancellable(appt) {
    if(appt.status!=='confirmed')return false;
    const [dd,mm,yy]=appt.date.split('/'); const [hh,mn]=appt.time.split(':');
    return (new Date(+yy,+mm-1,+dd,+hh,+mn)-new Date())>60*60*1000;
  }
};

const Toast={
  init(){ if(!document.getElementById('toastContainer')){ const c=document.createElement('div'); c.className='toast-container'; c.id='toastContainer'; document.body.appendChild(c); } },
  show(msg,type='info',dur=3800){
    this.init();
    const ic={success:'✓',error:'✕',info:'ℹ',warning:'⚠'};
    const t=document.createElement('div'); t.className=`toast ${type}`; t.innerHTML=`<span class="toast-icon">${ic[type]||'•'}</span><span>${msg}</span>`;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(()=>{ t.style.cssText='opacity:0;transform:translateX(20px);transition:all .3s'; setTimeout(()=>t.remove(),300); },dur);
  }
};

const Dates={
  D:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  M:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  getNext(n=14){
    const t=new Date();
    return Array.from({length:n},(_,i)=>{ const d=new Date(t); d.setDate(t.getDate()+i); return {dow:this.D[d.getDay()],day:d.getDate(),month:this.M[d.getMonth()],weekday:d.getDay(),key:d.toLocaleDateString('es-AR'),iso:d.toISOString().slice(0,10)}; });
  },
  label(key){ const [dd,mm,yy]=key.split('/'); const d=new Date(+yy,+mm-1,+dd); return `${this.D[d.getDay()]} ${d.getDate()} de ${this.M[d.getMonth()]}`; },
  toMs(date,time){ const [dd,mm,yy]=date.split('/'); const [hh,mn]=time.split(':'); return new Date(+yy,+mm-1,+dd,+hh,+mn).getTime(); }
};

function requireAuth(role=null){
  const u=DB.getCurrentUser();
  if(!u){location.href='index.html';return null;}
  if(role&&u.role!==role){location.href=u.role==='business'?'business.html':'app.html';return null;}
  return u;
}
function logout(){ DB.logout(); location.href='index.html'; }

// ── RESEÑAS ──
DB.getReviews      = function()       { return JSON.parse(localStorage.getItem('sx_reviews')||'[]'); };
DB.saveReview      = function(r)      { const list=this.getReviews(), i=list.findIndex(x=>x.id===r.id); if(i>=0)list[i]=r; else list.push(r); localStorage.setItem('sx_reviews',JSON.stringify(list)); };
DB.getBizReviews   = function(bizId)  { return this.getReviews().filter(r=>r.bizId===bizId); };
DB.getUserReview   = function(uid,bid){ return this.getReviews().find(r=>r.userId===uid&&r.bizId===bid)||null; };
DB.deleteReview    = function(id)     { localStorage.setItem('sx_reviews',JSON.stringify(this.getReviews().filter(r=>r.id!==id))); };
DB.getBizAvgRating = function(bizId)  {
  const rs=this.getBizReviews(bizId).filter(r=>r.rating>0);
  return rs.length ? (rs.reduce((s,r)=>s+r.rating,0)/rs.length).toFixed(1) : null;
};

// ── CAMBIO DE INTERVALO DIFERIDO ──
// Guarda un cambio de intervalo pendiente. El nuevo intervalo se aplica a partir del
// primer día laboral DESPUÉS del último día con turnos activos agendados.
DB.setPendingInterval = function(bizId, newInterval) {
  const pending = this.getPendingIntervals();
  pending[bizId] = { newInterval, requestedAt: new Date().toISOString() };
  localStorage.setItem('sx_pending_intervals', JSON.stringify(pending));
};
DB.getPendingIntervals = function() {
  return JSON.parse(localStorage.getItem('sx_pending_intervals') || '{}');
};
DB.getPendingInterval = function(bizId) {
  return this.getPendingIntervals()[bizId] || null;
};
DB.clearPendingInterval = function(bizId) {
  const pending = this.getPendingIntervals();
  delete pending[bizId];
  localStorage.setItem('sx_pending_intervals', JSON.stringify(pending));
};

// Devuelve la fecha (key es-AR) a partir de la cual debe aplicarse el nuevo intervalo:
// = primer día laboral del negocio DESPUÉS del último día con turnos activos.
// Si no hay turnos activos, devuelve null (se puede aplicar ya).
DB.getIntervalChangeDate = function(bizId) {
  const biz = this.getBusinesses().find(b => b.id === bizId);
  if (!biz) return null;
  const workDays = biz.workDays && biz.workDays.length ? biz.workDays : [0,1,2,3,4,5,6];
  const appts = this.getActiveAppts(bizId);
  if (!appts.length) return null; // sin turnos: se aplica de inmediato

  // Encontrar el turno más lejano en el tiempo
  let latestMs = 0;
  appts.forEach(a => {
    const [dd, mm, yy] = a.date.split('/');
    const ms = new Date(+yy, +mm - 1, +dd).getTime();
    if (ms > latestMs) latestMs = ms;
  });

  // Primer día laboral DESPUÉS de esa fecha
  const latestDate = new Date(latestMs);
  for (let i = 1; i <= 90; i++) {
    const d = new Date(latestDate);
    d.setDate(latestDate.getDate() + i);
    if (workDays.includes(d.getDay())) {
      return d.toLocaleDateString('es-AR');
    }
  }
  return null;
};

// Retrocompatibilidad: alias del nombre anterior usado en código heredado
DB.getFirstFreeDayForInterval = DB.getIntervalChangeDate;

// Aplica permanentemente el intervalo pendiente cuando ya todos los días con
// turnos del intervalo anterior quedaron en el pasado.
DB.tryApplyPendingInterval = function(bizId) {
  const pending = this.getPendingInterval(bizId);
  if (!pending) return false;
  const biz = this.getBusinesses().find(b => b.id === bizId);
  if (!biz) return false;

  const activeAppts = this.getActiveAppts(bizId);

  // Sin ningún turno activo → aplicar de inmediato
  if (!activeAppts.length) {
    biz.interval = pending.newInterval;
    this.saveBusiness(biz);
    this.clearPendingInterval(bizId);
    return true;
  }

  // Si la fecha de cambio ya llegó o pasó → aplicar (todos los días con el
  // intervalo viejo ya transcurrieron)
  const changeDate = this.getIntervalChangeDate(bizId);
  if (changeDate) {
    const [dd, mm, yy] = changeDate.split('/');
    const changeDateStart = new Date(+yy, +mm - 1, +dd);
    changeDateStart.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (todayStart >= changeDateStart) {
      biz.interval = pending.newInterval;
      this.saveBusiness(biz);
      this.clearPendingInterval(bizId);
      return true;
    }
  }

  return false; // todavía hay días futuros con turnos del intervalo anterior
};
