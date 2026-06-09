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
  isTaken(bizId,date,time,serviceName=null) {
    const capacity = this.getSlotCapacity(bizId,serviceName);
    return this.getSlotCount(bizId,date,time,serviceName) >= capacity;
  },
  getSlotCapacity(bizId,serviceName=null) {
    const biz = this.getBusinesses().find(b=>b.id===bizId);
    if (serviceName) {
      const services = this.getBizServices(bizId);
      const svc = services.find(s=>s.name===serviceName);
      if (svc && svc.capacity && svc.capacity > 1) return svc.capacity;
    }
    return (biz && biz.slotCapacity && biz.slotCapacity > 1) ? biz.slotCapacity : 1;
  },
  getSlotCount(bizId,date,time,serviceName=null) {
    return this.getAppointments().filter(a=>
      a.bizId===bizId && a.date===date && a.time===time && !a.status.startsWith('cancel') &&
      (serviceName==null || a.serviceName===serviceName)
    ).length;
  },
  getSlotRemaining(bizId,date,time,serviceName=null) {
    const capacity = this.getSlotCapacity(bizId,serviceName);
    const used = this.getSlotCount(bizId,date,time,serviceName);
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
    if(!start||!end||interval<=0) return [];
    const s=[];
    let [sh,sm]=start.split(':').map(Number);
    let [eh,em]=end.split(':').map(Number);
    let startMin=sh*60+sm, endMin=eh*60+em;
    // Horario nocturno: el cierre es del día siguiente (ej. 09:00 → 02:00)
    // Si son exactamente iguales no generamos nada (evita loop de 24h)
    if(endMin===startMin) return [];
    if(endMin<startMin) endMin+=1440;
    let cur=startMin, iters=0;
    while(cur<endMin && iters<1440){
      const hh=Math.floor(cur/60)%24, mm=cur%60;
      s.push(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
      cur+=interval; iters++;
    }
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

// ══════════════════════════════════════════════════════════════════
//  CAMBIOS DE INTERVALO DIFERIDOS
//
//  Cuando se cambia el intervalo (del negocio o de un servicio) y
//  ya hay turnos reservados, el cambio NO se aplica de inmediato.
//  Se guarda como "pendiente" y se aplica el primer día laboral
//  futuro que no tenga ningún turno reservado.
//
//  Clave de almacenamiento:
//    negocio  → "bizId"
//    servicio → "bizId::svcName"
//
//  Cada entrada guarda:
//    { newInterval, oldInterval, changeDate, requestedAt }
//    changeDate = fecha (key es-AR) del primer día libre encontrado
// ══════════════════════════════════════════════════════════════════

// Devuelve todos los pendientes (objeto clave→datos)
DB.getAllPendingIntervals = function() {
  return JSON.parse(localStorage.getItem('sx_pending_iv') || '{}');
};
DB._savePendingIntervals = function(all) {
  localStorage.setItem('sx_pending_iv', JSON.stringify(all));
};

// Lee el pendiente de una clave específica (bizId o "bizId::svcName")
DB.getPendingIv = function(key) {
  return this.getAllPendingIntervals()[key] || null;
};

// Guarda un pendiente. Calcula la changeDate automáticamente.
// scope = 'biz' | 'svc' | 'staff'
// svcName: nombre del servicio  (o null)
// staffId: id del staff         (o null)
DB.setPendingIv = function(bizId, newInterval, oldInterval, svcName, staffId) {
  const key = staffId
    ? `${bizId}::staff::${staffId}`
    : svcName ? `${bizId}::${svcName}` : String(bizId);
  const changeDate = this._findFirstFreeDay(bizId, svcName || null, staffId || null);
  const all = this.getAllPendingIntervals();
  all[key] = {
    newInterval,
    oldInterval,
    changeDate,
    svcName:  svcName  || null,
    staffId:  staffId  || null,
    requestedAt: new Date().toISOString(),
    dismissed: false,
  };
  this._savePendingIntervals(all);
  return all[key];
};

// Elimina el pendiente de una clave
DB.clearPendingIv = function(bizId, svcName, staffId) {
  const key = staffId
    ? `${bizId}::staff::${staffId}`
    : svcName ? `${bizId}::${svcName}` : String(bizId);
  const all = this.getAllPendingIntervals();
  delete all[key];
  this._savePendingIntervals(all);
};

// Marca como visto (el negocio hizo dismiss del banner)
DB.dismissPendingIv = function(bizId, svcName, staffId) {
  const key = staffId
    ? `${bizId}::staff::${staffId}`
    : svcName ? `${bizId}::${svcName}` : String(bizId);
  const all = this.getAllPendingIntervals();
  if (all[key]) all[key].dismissed = true;
  this._savePendingIntervals(all);
};

// Devuelve todos los pendientes no descartados de un negocio
DB.getPendingIvList = function(bizId) {
  const all = this.getAllPendingIntervals();
  return Object.entries(all)
    .filter(([k]) => k === String(bizId) || k.startsWith(`${bizId}::`))
    .map(([k, v]) => ({ key: k, ...v }));
};

// Devuelve todos los pendientes no descartados de un negocio (solo los no dismissed)
DB.getUndismissedPendingIvList = function(bizId) {
  return this.getPendingIvList(bizId).filter(p => !p.dismissed);
};

// Calcula la changeDate: primer día laboral futuro sin turnos
// svcName=null, staffId=null → todos los turnos del negocio
// svcName='X'               → solo turnos de ese servicio
// staffId='X'               → solo turnos de esa persona
DB._findFirstFreeDay = function(bizId, svcName, staffId) {
  const biz = this.getBusinesses().find(b => b.id === bizId);
  const workDays = (biz && biz.workDays && biz.workDays.length)
    ? biz.workDays
    : [0,1,2,3,4,5,6];

  let appts = this.getActiveAppts(bizId);
  if (staffId)  appts = appts.filter(a => a.staffId  === staffId);
  else if (svcName) appts = appts.filter(a => a.serviceName === svcName);
  if (!appts.length) return null; // sin turnos → aplica ya

  const occupied = new Set(appts.map(a => a.date));

  // Iterar desde mañana hasta 90 días
  const today = new Date();
  today.setHours(0,0,0,0);
  for (let i = 1; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (!workDays.includes(d.getDay())) continue;
    const key = d.toLocaleDateString('es-AR');
    if (!occupied.has(key)) return key;
  }

  // Fallback: primer día laboral después del último turno reservado
  let latestMs = 0;
  appts.forEach(a => {
    const [dd,mm,yy] = a.date.split('/');
    const ms = new Date(+yy,+mm-1,+dd).getTime();
    if (ms > latestMs) latestMs = ms;
  });
  const last = new Date(latestMs);
  for (let i = 1; i <= 90; i++) {
    const d = new Date(last);
    d.setDate(last.getDate() + i);
    if (workDays.includes(d.getDay())) return d.toLocaleDateString('es-AR');
  }
  return null;
};

// Devuelve el intervalo efectivo para una fecha dada.
// staffId: si se pasa, busca el pendiente del staff
// svcName: si se pasa, busca el pendiente del servicio
// Si no hay pendiente devuelve null (usar el valor guardado normalmente).
DB.getEffectiveInterval = function(bizId, date, svcName, staffId) {
  const key = staffId
    ? `${bizId}::staff::${staffId}`
    : svcName ? `${bizId}::${svcName}` : String(bizId);
  const p = this.getAllPendingIntervals()[key] || null;
  if (!p) return null;

  if (!p.changeDate) {
    this.clearPendingIv(bizId, svcName || null, staffId || null);
    return p.newInterval;
  }

  const [dd,mm,yy] = p.changeDate.split('/');
  const changeMs = new Date(+yy,+mm-1,+dd).getTime();

  let dateMs;
  if (date) {
    const [d2,m2,y2] = date.split('/');
    dateMs = new Date(+y2,+m2-1,+d2).getTime();
  } else {
    const t = new Date(); t.setHours(0,0,0,0);
    dateMs = t.getTime();
  }

  if (dateMs >= changeMs) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (today.getTime() >= changeMs) {
      this.clearPendingIv(bizId, svcName || null, staffId || null);
    }
    return p.newInterval;
  }

  return p.oldInterval;
};

// Compatibilidad con código anterior que llama DB.getPendingInterval(bizId)
DB.getPendingInterval  = function(bizId)       { return this.getAllPendingIntervals()[String(bizId)] || null; };
DB.setPendingInterval  = function(bizId, newIv) { /* usar setPendingIv */ };
DB.clearPendingInterval = function(bizId)       { this.clearPendingIv(bizId, null); };
DB.getIntervalChangeDate = function(bizId)      {
  const p = this.getAllPendingIntervals()[String(bizId)];
  return p ? p.changeDate : null;
};
DB.getFirstFreeDayForInterval = DB.getIntervalChangeDate;
DB.getPendingIntervals = function()             { return this.getAllPendingIntervals(); };
DB.tryApplyPendingInterval = function(bizId)    { return false; }; // ya no necesario, getEffectiveInterval lo hace



// ── SERVICIOS ──
// Un negocio puede tener múltiples servicios, cada uno con nombre, descripción,
// precio (opcional) y duración (opcional). Si no hay servicios definidos, se
// toma el precio global del negocio (biz.price) como antes.
DB.getBizServices  = function(bizId)    { return JSON.parse(localStorage.getItem('sx_services_'+bizId)||'[]'); };
DB.saveBizServices = function(bizId, services) { localStorage.setItem('sx_services_'+bizId, JSON.stringify(services)); };
DB.deleteBizServices = function(bizId)  { localStorage.removeItem('sx_services_'+bizId); };

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

// ── STAFF (PERSONAS QUE ATIENDEN) ──
// Cada negocio puede tener múltiples "profesionales" o personas que atienden.
// Cada staff tiene: id, bizId, name, role (cargo), icon, color,
//   workDays (array de ints), start, end, start2, end2, interval (min),
//   serviceIds (array de nombres de servicios que atiende)
DB.getBizStaff    = function(bizId)  { return JSON.parse(localStorage.getItem('sx_staff_'+bizId)||'[]'); };
DB.saveBizStaff   = function(bizId, staff) { localStorage.setItem('sx_staff_'+bizId, JSON.stringify(staff)); };
DB.saveStaffMember = function(bizId, member) {
  const list = this.getBizStaff(bizId);
  const idx = list.findIndex(s => s.id === member.id);
  if (idx >= 0) list[idx] = member; else list.push(member);
  this.saveBizStaff(bizId, list);
};
DB.deleteStaffMember = function(bizId, staffId) {
  const list = this.getBizStaff(bizId).filter(s => s.id !== staffId);
  this.saveBizStaff(bizId, list);
  // Limpiar turnos asociados (no cancelar, solo limpiar el staffId)
  const appts = this.getAppointments();
  appts.forEach(a => { if (a.staffId === staffId) { delete a.staffId; delete a.staffName; } });
  localStorage.setItem('sx_appointments', JSON.stringify(appts));
};
DB.getStaffMember = function(bizId, staffId) {
  return this.getBizStaff(bizId).find(s => s.id === staffId) || null;
};

// Slots ocupados para un staff específico
DB.getStaffSlotCount = function(bizId, staffId, date, time) {
  return this.getAppointments().filter(a =>
    a.bizId === bizId && a.staffId === staffId &&
    a.date === date && a.time === time &&
    !a.status.startsWith('cancel')
  ).length;
};
DB.isStaffTaken = function(bizId, staffId, date, time, capacity) {
  return this.getStaffSlotCount(bizId, staffId, date, time) >= (capacity || 1);
};
DB.getStaffSlotRemaining = function(bizId, staffId, date, time, capacity) {
  return Math.max(0, (capacity || 1) - this.getStaffSlotCount(bizId, staffId, date, time));
};