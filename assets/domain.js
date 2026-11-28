/* Pure, shared business rules. Browser + Node, no network or DOM dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MiskDomain=api;})(globalThis,()=>{
  'use strict';
  const DAY=86400000;
  const text=v=>String(v??'').trim();
  const escape=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tech=j=>text(j.tech||j.tech_name||j.Tech)||'غير مسند';
  const status=j=>text(j.status)||'جديد';
  const done=j=>status(j)==='تم التسليم';
  const problem=j=>['تأجيل','لم يتم الرد','رفض الزيارة'].includes(status(j));
  const pending=j=>!done(j)&&!problem(j);
  function timestamp(value){if(!value)return NaN;const match=text(value).match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);return match?new Date(+match[3],+match[2]-1,+match[1]).getTime():new Date(value).getTime();}
  function age(value,now=Date.now()){const date=timestamp(value);return Number.isFinite(date)?Math.max(0,Math.floor((now-date)/DAY)):null;}
  function bounds(days,now=Date.now()){const end=new Date(now);end.setHours(23,59,59,999);const start=new Date(end);start.setDate(start.getDate()-days+1);start.setHours(0,0,0,0);const previous=new Date(start);previous.setDate(previous.getDate()-days);return {start:+start,end:+end,previous:+previous};}
  function analytics(jobs,days=14,selectedTech='',now=Date.now()){
    const {start,end,previous}=bounds(days,now);
    const scoped=jobs.filter(j=>!selectedTech||tech(j)===selectedTech);
    const current=scoped.filter(j=>timestamp(j.created_at)>=start&&timestamp(j.created_at)<=end);
    const prior=scoped.filter(j=>timestamp(j.created_at)>=previous&&timestamp(j.created_at)<start);
    const summarize=rows=>({total:rows.length,done:rows.filter(done).length,pending:rows.filter(pending).length,problem:rows.filter(problem).length,rate:rows.length?Math.round(rows.filter(done).length/rows.length*100):null});
    const team=new Map();current.forEach(j=>{const name=tech(j);if(!team.has(name))team.set(name,[]);team.get(name).push(j);});
    const daily=Array.from({length:days},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const next=new Date(d);next.setDate(next.getDate()+1);return {date:d,...summarize(current.filter(j=>timestamp(j.created_at)>=+d&&timestamp(j.created_at)<+next))};});
    return {current,prior,summary:summarize(current),previous:summarize(prior),daily,team:[...team].map(([name,rows])=>({name,...summarize(rows)})).sort((a,b)=>b.total-a.total),invalidDates:scoped.filter(j=>!Number.isFinite(timestamp(j.created_at))).length};
  }
  function alerts(jobs,devices=[],now=Date.now()){
    const rows=[];
    const add=(kind,j,severity,title,reason,entity='job')=>rows.push({key:JSON.stringify([entity,text(j.id||j.serial),kind,status(j)]),id:text(j.id||j.serial),kind,severity,title,reason,entity,job:j,age:age(j.created_at,now)});
    for(const j of jobs){
      if(problem(j))add('visit',j,status(j)==='رفض الزيارة'?'high':'medium',status(j),text(j.comment)||'راجع سبب الزيارة وحدد الخطوة التالية مع العميل.');
      if(pending(j)&&age(j.created_at,now)>=3)add('overdue',j,age(j.created_at,now)>=7?'high':'medium','مهمة متأخرة',`مرّ ${age(j.created_at,now)} يومًا منذ الإضافة ولم تُغلق المهمة.`);
      if(!done(j)&&tech(j)==='غير مسند')add('unassigned',j,'medium','مهمة غير مسندة','لا يوجد فني مسجل لهذه المهمة.');
      if(done(j)&&!text(j.serial))add('quality',j,'high','تسليم دون سيريال','المهمة مسلّمة لكن الرقم التسلسلي غير مسجل. راجع البيانات.');
    }
    for(const d of devices)if(!text(d.customer_phone)&&!text(d.date_install)&&age(d.date_received||d.date,now)>=60)add('stock',d,'medium','عهدة قديمة',`الجهاز ${text(d.serial)||'غير محدد'} في العهدة منذ ${age(d.date_received||d.date,now)} يومًا.`,'device');
    return rows.sort((a,b)=>(a.severity==='high'?0:1)-(b.severity==='high'?0:1)||(b.age||0)-(a.age||0)||a.key.localeCompare(b.key));
  }
  function queue(jobs,{search='',technician='',bucket='',sort='oldest'}={},now=Date.now()){
    const q=text(search).toLocaleLowerCase();
    const rows=jobs.filter(pending).filter(j=>!technician||tech(j)===technician).filter(j=>!q||[j.customer_name,j.order,j.landline,j.mobile,j.serial,j.address].some(v=>text(v).toLocaleLowerCase().includes(q))).filter(j=>{const n=age(j.created_at,now);return !bucket||(bucket==='unknown'?n===null:bucket==='new'?n!==null&&n<3:bucket==='aging'?n>=3&&n<7:n>=7);});
    return rows.sort((a,b)=>{const x=timestamp(a.created_at),y=timestamp(b.created_at);if(!Number.isFinite(x))return Number.isFinite(y)?1:0;if(!Number.isFinite(y))return -1;return sort==='newest'?y-x:x-y;});
  }
  // Prefix formula-like values before CSV quoting to protect spreadsheet consumers.
  function csv(rows){return '\uFEFF'+rows.map(row=>row.map(value=>{let cell=String(value??'');if(/^[\s]*[=+@-]/.test(cell))cell="'"+cell;return '"'+cell.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
  return {DAY,text,escape,tech,status,done,problem,pending,timestamp,age,bounds,analytics,alerts,queue,csv};
});
