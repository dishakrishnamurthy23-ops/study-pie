(function(){
/* ============ Study Pie: how the app works ============
   PLAN (plan-data.js) = the original study plan
   S                   = everything YOU change: ticks, edits, new blocks, logs, settings (saved in this browser)
   The app shows PLAN + your edits merged together.
   Tabs: Day (24-hour wheel) · Week · Journey (one track's weeks) · Log (mistakes, mocks, checklists, settings) */
const $=s=>document.querySelector(s);
const NS="http://www.w3.org/2000/svg";
const LS="study-pie-v1";
const COLORS=CONFIG.colors.map(c=>c.name);
CONFIG.colors.forEach(c=>document.documentElement.style.setProperty("--c-"+c.name,c.hex));
const TRACKS=CONFIG.tracks;
const WEEKDAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUS={done:{t:"Done",i:"✔",e:"✅"},partly:{t:"Partly",i:"½",e:"🌓"},skipped:{t:"Skipped",i:"✕",e:"⏭️"}};
const SLOT_NAMES={mern:"💻 MERN hour",gateA:"📘 GATE afternoon",gateE:"📘 GATE evening",gateF:"🏁 GATE final revision (Feb)",gre:"✈️ GRE evening"};

/* ---------- helpers ---------- */
const uid=()=>Math.random().toString(36).slice(2,9);
const pad=n=>String(n).padStart(2,"0");
const dkey=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const pkey=k=>{const[y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(k,n)=>{const d=pkey(k);d.setDate(d.getDate()+n);return dkey(d)};
const addStudyDays=(k,n)=>{let d=k,left=Math.abs(n),step=n<0?-1:1;while(left>0){d=addDays(d,step);if(pkey(d).getDay()!==0)left--}return d};
const daysBetween=(a,b)=>Math.round((pkey(b)-pkey(a))/864e5);
const todayKey=()=>dkey(new Date());
const mondayOf=k=>addDays(k,-((pkey(k).getDay()+6)%7));
const toMin=t=>{const[a,b]=(t||"0:0").split(":").map(Number);return (a||0)*60+(b||0)};
const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
const fmt=m=>{m=((m%1440)+1440)%1440;let h=Math.floor(m/60),mm=m%60,ap=h<12?"AM":"PM";h=h%12||12;return h+(mm?":"+pad(mm):"")+" "+ap};
const dur=m=>{const h=Math.floor(m/60),mm=m%60;return (h?h+"h ":"")+(mm||!h?mm+"m":"")};
const nice=k=>{const d=pkey(k);return WEEKDAYS[d.getDay()]+" "+d.getDate()+" "+MONTHS[d.getMonth()].slice(0,3)};
const col=c=>"var(--c-"+(COLORS.includes(c)?c:"sky")+")";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const el=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e};
const P=(r,a)=>[r*Math.cos(a*Math.PI/180),r*Math.sin(a*Math.PI/180)];
const clone=o=>JSON.parse(JSON.stringify(o));
function arc(r0,r1,a0,a1){
  if(a1-a0>=359.9)a1=a0+359.9;
  const L=a1-a0>180?1:0,[x0,y0]=P(r1,a0),[x1,y1]=P(r1,a1),[x2,y2]=P(r0,a1),[x3,y3]=P(r0,a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 ${L} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${L} 0 ${x3} ${y3}Z`;
}
function wrapLines(text,max){
  const words=String(text).split(/\s+/);if(text.length<=max||words.length<2)return [text];
  let best=[text],bd=1e9;
  for(let i=1;i<words.length;i++){const a=words.slice(0,i).join(" "),b=words.slice(i).join(" "),d=Math.max(a.length,b.length);if(d<bd){bd=d;best=[a,b]}}
  return best;
}

/* ---------- state ---------- */
let S=null,tab="today",sel=todayKey(),track="gate",openId=null,editId=null,newId=null,confirmId=null,delNote=null,timer=null,lastToday=todayKey(),logSec="mistakes",msg="";
try{const t=localStorage.getItem(LS+"-tab");if(["today","week","journey","log"].includes(t))tab=t}catch(e){}

/* ---------- the plan (original + your edits) ---------- */
let BLOCKS=[],BY_DATE={},BY_WEEK={},FIRST="",LAST="";
const slot=b=>(b.start&&b.end)?{start:b.start,end:b.end}:((S.slots||{})[b.sl]||CONFIG.slots[b.sl]||{start:"09:00",end:"10:00"});
const look=b=>{const s=CONFIG.subjects[b.sub]||{},t=TRACKS[b.tr]||{};return {color:s.color||t.color,emoji:s.emoji||t.emoji}};
function weekFor(tr,d){const ws=PLAN.weeks[tr];if(!ws||!ws.length)return 0;
  const hit=ws.find(w=>d>=w.s&&d<=addDays(w.e,1));if(hit)return hit.n;if(d<ws[0].s)return ws[0].n;
  return [...ws].reverse().find(w=>w.s<=d).n}
function buildIndex(){
  BLOCKS=PLAN.blocks.map(b=>S.edits[b.id]?Object.assign({},b,S.edits[b.id]):b).filter(b=>!b.del).concat(S.custom);
  BY_DATE={};BY_WEEK={};
  BLOCKS.forEach(b=>{(BY_DATE[b.d]=BY_DATE[b.d]||[]).push(b);(BY_WEEK[b.tr+"-"+b.w]=BY_WEEK[b.tr+"-"+b.w]||[]).push(b)});
  for(const k in BY_DATE)BY_DATE[k].sort((a,b)=>toMin(slot(a).start)-toMin(slot(b).start));
  const ds=Object.keys(BY_DATE).sort();FIRST=ds[0]||todayKey();LAST=ds[ds.length-1]||todayKey();
}
const blockById=id=>BLOCKS.find(b=>b.id===id);
const isPlan=id=>!String(id).startsWith("c-");

const score=b=>({done:1,partly:.5}[S.status[b.id]]||0);
function stats(list){const total=list.length,got=list.reduce((a,b)=>a+score(b),0),doneN=list.filter(b=>S.status[b.id]==="done").length;
  return {total,doneN,pct:total?got/total:0}}
const dayStats=k=>stats(BY_DATE[k]||[]);
function restText(k){
  if(k<FIRST)return `Your plan starts ${nice(FIRST)} 🚀`;
  if(k>LAST)return "Plan complete! 🎉 Time for applications.";
  if(pkey(k).getDay()===0)return "Sunday = rest day 😴 Optional: catch up on unmarked blocks.";
  if(k>="2027-02-20"&&k<"2027-03-01")return "GATE exam days + rest week 🎯 GRE starts Mon 1 Mar.";
  return "No study blocks on this day 😴";
}
function unmarked(){const tk=todayKey(),n=nowMin();
  return BLOCKS.filter(b=>!S.status[b.id]&&(b.d<tk||(b.d===tk&&toMin(slot(b).end)<=n))).sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:toMin(slot(a).start)-toMin(slot(b).start))}
function upcoming(count,cur){
  const tk=todayKey(),n=nowMin(),out=[];
  for(let i=0;i<40&&out.length<count;i++){const k=addDays(tk,i);
    for(const b of BY_DATE[k]||[]){if(out.length>=count)break;const a=toMin(slot(b).start);
      if(cur&&b.id===cur.id)continue;if(i===0&&a<=n)continue;
      out.push({b,when:i===0?`at ${fmt(a)} (in ${dur(a-n)})`:i===1?`tomorrow at ${fmt(a)}`:`${nice(k)}, ${fmt(a)}`})}}
  return out;
}
function subChips(b){
  if(!b.subs||!b.subs.length)return "";const on=S.subs[b.id]||[];
  return `<div class="habits">${b.subs.map((t,i)=>{const c=on.includes(i);
    return `<label class="hab${c?" on":""}"><input type="checkbox" class="chk hchk" data-b="${b.id}" data-i="${i}" ${c?"checked":""}><span>${esc(t)}</span></label>`}).join("")}</div>`;
}

/* ---------- wheels ---------- */
const R0=36,R1=178;
function baseDefs(svg){
  const defs=el("defs",{},svg);
  const pat=el("pattern",{id:"hatch",width:"6",height:"6",patternUnits:"userSpaceOnUse",patternTransform:"rotate(35)"},defs);
  el("line",{x1:"0",y1:"0",x2:"0",y2:"6",stroke:"#ffffff","stroke-width":"1.6","stroke-opacity":".35"},pat);
  const f=el("filter",{id:"wobble",x:"-5%",y:"-5%",width:"110%",height:"110%"},defs);
  el("feTurbulence",{type:"fractalNoise",baseFrequency:"0.035",numOctaves:"2",seed:"4"},f);
  el("feDisplacementMap",{in:"SourceGraphic",scale:"3.5"},f);
}
function hub(svg,l1,l2){
  el("circle",{r:R0,class:"hub",filter:"url(#wobble)"},svg);
  el("text",{y:"-2","text-anchor":"middle","font-size":l1.length>4?"17":"21",class:"hubtxt"},svg).textContent=l1;
  el("text",{y:"16","text-anchor":"middle","font-size":"12",class:"hubtxt"},svg).textContent=l2;
}
function hand(svg,frac){const ha=frac*360-90,[hx,hy]=P(R1+14,ha);
  el("line",{x1:"0",y1:"0",x2:hx,y2:hy,class:"hand"},svg);el("circle",{cx:hx,cy:hy,r:"5",class:"handtip"},svg)}
function clickable(grp,label,go){grp.setAttribute("tabindex","0");grp.setAttribute("role","button");grp.setAttribute("aria-label",label);
  grp.addEventListener("click",go);grp.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}})}
function sliceText(gText,span,mid,emoji,label,dim){
  const tg=el("g",{class:dim?"dim":""},gText);
  if(span>=40){
    const rr=span>120?98:108,[x,y]=P(rr,mid),lines=wrapLines(label,11);
    const width=Math.min(rr*span*Math.PI/180*.75,150),longest=Math.max(...lines.map(l=>l.length),1);
    const fs=Math.max(12,Math.min(span>120?30:20,width/(longest*.5)));
    el("text",{x,y:y-fs*(lines.length/2)-6,"text-anchor":"middle","font-size":Math.min(30,fs+8),class:"semo"},tg).textContent=emoji||"";
    lines.forEach((l,k)=>{el("text",{x,y:y+fs*.35+(k-(lines.length-1)/2)*fs*1.05+6,"text-anchor":"middle","font-size":fs,class:"stxt"},tg).textContent=l});
  }else{
    const arcW=110*span*Math.PI/180;let fs=Math.min(17,arcW*.62),txt=label;
    if(fs>=7.5){const maxLen=Math.floor(95/(fs*.48));if(txt.length>maxLen)txt=txt.slice(0,maxLen-1)+"…";
      const flip=mid>90&&mid<270,rot=flip?mid+180:mid,[x,y]=P(100,mid);
      el("text",{x,y,"text-anchor":"middle","dominant-baseline":"central","font-size":fs,class:"stxt",transform:`rotate(${rot} ${x} ${y})`},tg).textContent=txt}
    if(arcW>14&&emoji){const [ex,ey]=P(158,mid);el("text",{x:ex,y:ey,"text-anchor":"middle","dominant-baseline":"central","font-size":Math.min(20,arcW*.75),class:"semo"},tg).textContent=emoji}
  }
}
function drawDay(svg){
  const list=BY_DATE[sel]||[],isToday=sel===todayKey(),n=nowMin();
  el("circle",{r:R1,class:"gap"},svg);
  const gS=el("g",{filter:"url(#wobble)"},svg),gT=el("g",{},svg);
  list.forEach(b=>{
    const s=slot(b),a=toMin(s.start),e=Math.max(toMin(s.end),a+5),a0=a/1440*360-90,a1=e/1440*360-90,L=look(b),st=S.status[b.id];
    const grp=el("g",{class:"slice-g"+(openId===b.id?" sel":"")},gS),d=arc(R0,R1,a0,a1);
    el("path",{d,class:"slice",fill:col(L.color)},grp);el("path",{d,fill:"url(#hatch)","pointer-events":"none"},grp);
    if(isToday&&n>=a&&n<e)el("path",{d:arc(R1+2,R1+9,a0,a1),fill:"var(--accent)"},grp);
    clickable(grp,b.t,()=>{openId=b.id;editId=null;rerender();scrollRow(b.id)});
    const span=a1-a0,mid=(a0+a1)/2;sliceText(gT,span,mid,L.emoji,b.t,st==="done"||st==="skipped");
    if(st){const [cx,cy]=P(166,mid);el("text",{x:cx,y:cy,"font-size":"18","text-anchor":"middle","dominant-baseline":"central",fill:"var(--slice-ink)"},gT).textContent=STATUS[st].i}
  });
  if(!list.length){el("text",{y:"-92","text-anchor":"middle","font-size":"44",class:"semo"},svg).textContent=sel<FIRST?"🚀":sel>LAST?"🎉":"😴";
    el("text",{y:"-55","text-anchor":"middle","font-size":"22",class:"hubtxt"},svg).textContent=sel<FIRST?"starts soon":sel>LAST?"all done":"rest day"}
  el("circle",{r:R1,class:"outer",filter:"url(#wobble)"},svg);
  for(let h=0;h<24;h++){const a=h/24*360-90,[x,y]=P(201,a),[x1,y1]=P(R1,a),[x2,y2]=P(R1+6,a);
    el("line",{x1,y1,x2,y2,stroke:"var(--ink)","stroke-width":"1.5"},svg);
    el("text",{x,y,"text-anchor":"middle","dominant-baseline":"central",class:"ring-num"},svg).textContent=(h%12)||12;
    if(h===0||h===12){const [sx,sy]=P(222,a);el("text",{x:sx,y:sy,"text-anchor":"middle","dominant-baseline":"central",class:"ring-num small"},svg).textContent=h?"noon":"midnight"}}
  if(isToday)hand(svg,n/1440);
  if(isToday){const t=fmt(n).split(" ");hub(svg,t[0],t[1])}else{const d=pkey(sel);hub(svg,WEEKDAYS[d.getDay()],d.getDate()+" "+MONTHS[d.getMonth()].slice(0,3))}
}
function progressSlice(gS,gT,a0,a1,color,pct,label,go,isCur,inner){
  const grp=el("g",{class:"slice-g"},gS),d=arc(R0,R1,a0,a1);
  el("path",{d,class:"slice base",fill:col(color)},grp);
  if(pct>0)el("path",{d:arc(R0,R0+(R1-R0)*Math.min(1,pct),a0,a1),class:"prog"},grp);
  el("path",{d,fill:"url(#hatch)","pointer-events":"none"},grp);
  el("path",{d,class:"slice",fill:"none"},grp);
  if(isCur)el("path",{d:arc(R1+2,R1+9,a0,a1),fill:"var(--accent)"},grp);
  clickable(grp,label,go);
  inner(gT,(a0+a1)/2,a1-a0);
}
function drawWeek(svg){
  const mon=mondayOf(sel),tk=todayKey();
  const gS=el("g",{filter:"url(#wobble)"},svg),gT=el("g",{},svg);
  let tot=0,got=0;
  for(let i=0;i<7;i++){
    const k=addDays(mon,i),list=BY_DATE[k]||[],st=stats(list),a0=i/7*360-90,a1=(i+1)/7*360-90;
    tot+=st.total;got+=st.pct*st.total;
    const color=list.length?look(list[list.length-1]).color:"sand";
    const emo=!list.length?"😴":st.doneN===list.length?"✅":"📚";
    progressSlice(gS,gT,a0,a1,color,st.pct,nice(k),()=>{sel=k;setTab("today")},k===tk,(g,mid,span)=>
      sliceText(g,span,mid,emo,list.length?`${st.doneN}/${list.length} done`:"rest",false));
    const [x,y]=P(205,(a0+a1)/2),d=pkey(k);
    el("text",{x,y:y-8,"text-anchor":"middle","dominant-baseline":"central",class:"ring-num"},svg).textContent=WEEKDAYS[d.getDay()];
    el("text",{x,y:y+10,"text-anchor":"middle","dominant-baseline":"central",class:"ring-num small"},svg).textContent=d.getDate()+" "+MONTHS[d.getMonth()].slice(0,3);
    const [x1,y1]=P(R1,a0),[x2,y2]=P(R1+8,a0);el("line",{x1,y1,x2,y2,stroke:"var(--ink)","stroke-width":"1.5"},svg);
  }
  el("circle",{r:R1,class:"outer",filter:"url(#wobble)"},svg);
  const off=daysBetween(mon,tk);if(off>=0&&off<7)hand(svg,(off+nowMin()/1440)/7);
  hub(svg,tot?Math.round(got/tot*100)+"%":"–","this week");
}
function drawJourney(svg){
  const weeks=PLAN.weeks[track]||[],n=weeks.length,tk=todayKey(),T=TRACKS[track];
  const gS=el("g",{filter:"url(#wobble)"},svg),gT=el("g",{},svg);
  let tot=0,got=0,handAt=-1;
  weeks.forEach((w,i)=>{
    const list=BY_WEEK[track+"-"+w.n]||[],st=stats(list),a0=i/n*360-90,a1=(i+1)/n*360-90;
    tot+=st.total;got+=st.pct*st.total;
    const isCur=tk>=w.s&&tk<=addDays(w.s,6);
    if(isCur)handAt=(i+Math.min(1,(daysBetween(w.s,tk)+nowMin()/1440)/Math.max(1,daysBetween(w.s,w.e)+1)))/n;
    progressSlice(gS,gT,a0,a1,T.color,st.pct,"Week "+w.n,()=>{sel=w.s;setTab("week")},isCur,(g,mid,span)=>
      sliceText(g,span,mid,"",st.pct>0?Math.round(st.pct*100)+"%":"",false));
    const [x,y]=P(203,(a0+a1)/2);
    el("text",{x,y,"text-anchor":"middle","dominant-baseline":"central",class:"ring-num","font-size":n>13?"14":"16"},svg).textContent="W"+w.n;
    const [x1,y1]=P(R1,a0),[x2,y2]=P(R1+8,a0);el("line",{x1,y1,x2,y2,stroke:"var(--ink)","stroke-width":"1.5"},svg);
  });
  el("circle",{r:R1,class:"outer",filter:"url(#wobble)"},svg);
  if(handAt>=0)hand(svg,handAt);
  hub(svg,Math.round(tot?got/tot*100:0)+"%",T.name);
}
function drawLog(svg){
  const trs=Object.keys(TRACKS).filter(t=>BLOCKS.some(b=>b.tr===t)),n=trs.length;
  const gS=el("g",{filter:"url(#wobble)"},svg),gT=el("g",{},svg);let tot=0,got=0;
  trs.forEach((t,i)=>{const list=BLOCKS.filter(b=>b.tr===t),st=stats(list),a0=i/n*360-90,a1=(i+1)/n*360-90;tot+=st.total;got+=st.pct*st.total;
    progressSlice(gS,gT,a0,a1,TRACKS[t].color,st.pct,TRACKS[t].name,()=>{if(PLAN.weeks[t]){track=t;setTab("journey")}},false,(g,mid,span)=>
      sliceText(g,span,mid,TRACKS[t].emoji,`${TRACKS[t].name} ${Math.round(st.pct*100)}%`,false));
    const [x,y]=P(205,(a0+a1)/2);el("text",{x,y,"text-anchor":"middle","dominant-baseline":"central",class:"ring-num small"},svg).textContent=`${st.doneN}/${st.total} done`});
  el("circle",{r:R1,class:"outer",filter:"url(#wobble)"},svg);
  hub(svg,Math.round(tot?got/tot*100:0)+"%","overall");
}
function drawWheel(){
  const svg=$("#wheel");svg.innerHTML="";baseDefs(svg);
  ({today:drawDay,week:drawWeek,journey:drawJourney,log:drawLog})[tab](svg);
  const lg=$("#legend");
  if(tab==="today"){const seen={};(BY_DATE[sel]||[]).forEach(b=>{seen[b.tr]=1});
    lg.innerHTML=Object.keys(seen).map(t=>`<span><i style="background:${col((TRACKS[t]||{}).color)}"></i>${esc((TRACKS[t]||{}).emoji)} ${esc((TRACKS[t]||{}).name)}</span>`).join("")+(Object.keys(seen).length?`<span>✔ done · ½ partly · ✕ skipped</span>`:"")}
  else lg.innerHTML=`<span><i style="background:var(--c-mint)"></i>green fill grows as you tick blocks</span>`;
}

/* ---------- Right now card ---------- */
function renderNow(){
  const tk=todayKey(),n=nowMin(),list=BY_DATE[tk]||[];
  const cur=list.find(b=>{const s=slot(b);return n>=toMin(s.start)&&n<toMin(s.end)});
  let h=`<h2>Right now</h2>`;
  if(cur){const s=slot(cur),a=toMin(s.start),e=toMin(s.end),L=look(cur),T=TRACKS[cur.tr]||{};
    h+=`<div class="big"><span class="emo">${L.emoji}</span><div><div class="lbl">${esc(cur.t)}</div><div class="meta">${esc(T.emoji)} ${esc(T.name)} · ${fmt(a)} to ${fmt(e)} · ${dur(e-n)} left</div></div></div><div class="bar"><i style="width:${Math.round((n-a)/Math.max(1,e-a)*100)}%"></i></div>`+subChips(cur)+
      `<div class="todo"><button class="btn primary" type="button" data-go="${tk}" data-open="${cur.id}">Open today's task</button></div>`;
  }else h+=`<div class="meta">${list.length?"No study block right now. Breathe 🌿":esc(restText(tk))}</div>`;
  const nx=upcoming(2,cur);
  if(nx.length)h+=`<div class="next next-list">${nx.map((x,k)=>`<div>${k?"Then":"Up next"}: <b>${look(x.b).emoji} ${esc(x.b.t)}</b> ${x.when}</div>`).join("")}</div>`;
  const st=dayStats(tk);
  h+=`<div class="streak"><span>Today: ${st.doneN}/${st.total} done</span>`;
  for(let i=6;i>=0;i--){const k=addDays(tk,-i),s=dayStats(k),d=pkey(k);
    h+=`<span class="dot${i===0?" today":""}" data-go="${k}" role="button" tabindex="0" title="${nice(k)}: ${s.doneN}/${s.total}"><i style="height:${Math.round(s.pct*100)}%"></i><span>${WEEKDAYS[d.getDay()][0]}</span></span>`}
  h+=`</div>`;
  const um=unmarked();
  if(um.length)h+=`<div class="todo">📌 ${um.length} past block${um.length>1?"s":""} not marked yet <button class="btn" type="button" data-go="${um[0].d}" data-open="${um[0].id}">Review oldest</button>${um.length>=6?`<button class="btn" type="button" data-behind="1">⏩ I'm behind</button>`:""}</div>`;
  h+=`<div class="cd">${S.countdowns.map(c=>{if(!c.date)return "";const d=daysBetween(tk,c.date);return d>=0?`<span>${esc(c.emoji)} ${esc(c.label)} in <b>${d}</b> day${d===1?"":"s"}</span>`:""}).join("")}</div>`;
  $("#nowCard").innerHTML=h;
}

/* ---------- Day list: blocks ---------- */
function blockRow(b){
  const li=document.createElement("li"),open=openId===b.id,s=slot(b),a=toMin(s.start),e=toMin(s.end),L=look(b),T=TRACKS[b.tr]||{},st=S.status[b.id];
  const isCur=b.d===todayKey()&&nowMin()>=a&&nowMin()<e,edited=isPlan(b.id)&&S.edits[b.id];
  li.className="row"+(open?" open":"")+(isCur?" cur":"")+(st==="done"?" done":"");li.dataset.row=b.id;
  li.innerHTML=`<div class="head"><span class="sw" style="background:${col(L.color)}">${L.emoji}</span><span class="txt"><span class="t1">${esc(b.t)}</span><span class="t2">${fmt(a)} to ${fmt(e)} · ${esc(T.emoji)} ${esc(T.name)}${b.w?" · week "+b.w:""}${edited||!isPlan(b.id)?" · ✏️":""}</span></span><span class="badge ${st||"none"}">${st?STATUS[st].e+" "+STATUS[st].t:"to do"}</span></div>`+(open?"":subChips(b));
  if(open)li.appendChild(editId===b.id?blockForm(b):blockView(b));
  li.querySelector(".head").addEventListener("click",()=>{if(editId===b.id)return;openId=open?null:b.id;editId=null;confirmId=null;rerender()});
  return li;
}
function blockView(b){
  const box=document.createElement("div");box.className="edit";const st=S.status[b.id];
  box.innerHTML=`<ul class="det">${(b.det||[]).map(([ic,lb,tx,url])=>`<li><span class="ic">${esc(ic)}</span><span><span class="lb">${esc(lb)}</span><span class="tx">${esc(tx)}</span>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">🔎 Open this YouTube search</a>`:""}</span></li>`).join("")}</ul>`+
    (b.subs&&b.subs.length?`<div><label>Steps (tick as you go)</label>${subChips(b)}</div>`:"")+
    `<div><label>How did it go?</label><div class="stbtns">${Object.keys(STATUS).map(k=>`<button type="button" class="btn" data-st="${k}" aria-pressed="${st===k}">${STATUS[k].e} ${STATUS[k].t}</button>`).join("")}${st?`<button type="button" class="btn ghost" data-st="">Clear</button>`:""}</div></div>`+
    `<div><label for="bn-${b.id}">My note (where I got stuck, page numbers…)</label><textarea id="bn-${b.id}" maxlength="600">${esc(S.bnotes[b.id])}</textarea></div>`+
    `<div class="acts"><span class="acts-l"><button type="button" class="btn" data-edit="1">✏️ Edit block</button><button type="button" class="btn" data-mistake="1">📓 Log a mistake</button></span><button type="button" class="btn primary" data-close="1">Close</button></div>`;
  box.querySelectorAll("[data-st]").forEach(x=>x.addEventListener("click",()=>{const v=x.dataset.st;if(v)S.status[b.id]=v;else delete S.status[b.id];changed();rerender()}));
  const ta=box.querySelector("textarea");ta.addEventListener("input",()=>{if(ta.value.trim())S.bnotes[b.id]=ta.value;else delete S.bnotes[b.id];changed()});
  box.querySelector("[data-close]").addEventListener("click",()=>{openId=null;rerender()});
  box.querySelector("[data-edit]").addEventListener("click",()=>{editId=b.id;confirmId=null;msg="";rerender();scrollRow(b.id)});
  box.querySelector("[data-mistake]").addEventListener("click",()=>{const m={id:uid(),date:todayKey(),sub:b.sub==="MERN"||b.sub==="Capstone"?"MERN":b.sub,src:b.t===b.sub?"":b.t,why:"",fix:"",redo:false};
    S.errors.unshift(m);changed();logSec="mistakes";openId=m.id;setTab("log",true);scrollRow(m.id)});
  return box;
}
function blockForm(b){
  const box=document.createElement("div");box.className="edit form";const s=slot(b),plan=isPlan(b.id);
  const trOpts=Object.keys(TRACKS).map(t=>`<option value="${t}" ${t===b.tr?"selected":""}>${esc(TRACKS[t].emoji+" "+TRACKS[t].name)}</option>`).join("");
  box.innerHTML=`<p class="formhead">✏️ Editing this block. Change anything, then Save.</p>
    <div><label for="f-t">Title</label><input type="text" id="f-t" maxlength="60" value="${esc(b.t)}"></div>
    <div class="two"><div><label for="f-d">Date</label><input type="date" id="f-d" value="${esc(b.d)}"></div><div><label for="f-tr">Track</label><select id="f-tr">${trOpts}</select></div></div>
    <div class="two"><div><label for="f-s">Starts</label><input type="time" step="300" id="f-s" value="${esc(s.start)}"></div><div><label for="f-e">Ends</label><input type="time" step="300" id="f-e" value="${esc(s.end)}"></div></div>
    <div><label>Task details</label><ul class="items detedit">${(b.det||[]).map((d,i)=>detRow(d,i)).join("")}</ul><button type="button" class="btn x" data-adddet="1">+ Add a detail line</button></div>
    <div><label for="f-subs">Steps to tick (one per line)</label><textarea id="f-subs" rows="4">${esc((b.subs||[]).join("\n"))}</textarea></div>
    ${msg?`<p class="warn">${esc(msg)}</p>`:""}
    <div class="acts"><span class="acts-l">${confirmId===b.id?`<span>Delete this block? <button type="button" class="btn" data-del="yes">Yes, delete</button> <button type="button" class="btn ghost" data-del="no">Keep</button></span>`:`<button type="button" class="btn ghost" data-del="ask">🗑 Delete</button>`}${plan&&S.edits[b.id]?`<button type="button" class="btn ghost" data-reset="1">↺ Back to original plan</button>`:""}</span>
    <span class="acts-l"><button type="button" class="btn" data-cancel="1">Cancel</button><button type="button" class="btn primary" data-save="1">Save</button></span></div>`;
  const det=clone(b.det||[]);
  function readDet(){return [...box.querySelectorAll(".detedit li")].map(li=>{const i=+li.dataset.i,o=det[i]||["📝","",null,null];
    return [o[0]||"📝",li.querySelector("input").value.trim(),li.querySelector("textarea").value.trim(),o[3]||null]}).filter(d=>d[1]||d[2])}
  box.querySelector("[data-adddet]").addEventListener("click",()=>{det.push(["📝","Note","",null]);const ul=box.querySelector(".detedit");ul.insertAdjacentHTML("beforeend",detRow(det[det.length-1],det.length-1));bindDetRm()});
  function bindDetRm(){box.querySelectorAll("[data-rmdet]").forEach(x=>{x.onclick=()=>x.closest("li").remove()})}
  bindDetRm();
  box.querySelector("[data-cancel]").addEventListener("click",()=>{if(newId===b.id){S.custom=S.custom.filter(x=>x.id!==b.id);buildIndex();openId=null;changed()}newId=null;editId=null;msg="";rerender()});
  box.querySelector("[data-save]").addEventListener("click",()=>{
    const t=$("#f-t").value.trim()||"Study block",d=$("#f-d").value,st=$("#f-s").value,en=$("#f-e").value,tr=$("#f-tr").value;
    if(!d||!st||!en){msg="Please fill the date and both times.";rerender();return}
    if(toMin(en)<=toMin(st)){msg="End time must be after the start time (blocks can't cross midnight).";rerender();return}
    const subs=$("#f-subs").value.split("\n").map(x=>x.trim()).filter(Boolean);
    const fields={t,d,tr,start:st,end:en,det:readDet(),subs,w:weekFor(tr,d)};
    if(JSON.stringify(subs)!==JSON.stringify(b.subs||[]))delete S.subs[b.id];
    if(plan)S.edits[b.id]=Object.assign({},S.edits[b.id]||{},fields);
    else Object.assign(S.custom.find(x=>x.id===b.id),fields);
    newId=null;editId=null;msg="";sel=d;buildIndex();changed();rerender();scrollRow(b.id);
  });
  box.querySelectorAll("[data-del]").forEach(x=>x.addEventListener("click",()=>{const v=x.dataset.del;
    if(v==="ask")confirmId=b.id;else if(v==="no")confirmId=null;
    else{if(plan)S.edits[b.id]=Object.assign({},S.edits[b.id]||{},{del:true});else S.custom=S.custom.filter(c=>c.id!==b.id);
      delete S.status[b.id];delete S.subs[b.id];openId=editId=confirmId=newId=null;buildIndex();changed()}
    rerender()}));
  const rs=box.querySelector("[data-reset]");if(rs)rs.addEventListener("click",()=>{delete S.edits[b.id];delete S.subs[b.id];editId=null;sel=PLAN.blocks.find(x=>x.id===b.id).d;buildIndex();changed();rerender()});
  return box;
}
function detRow(d,i){return `<li class="detrow" data-i="${i}"><div class="detcol"><input type="text" value="${esc(d[1])}" placeholder="Label (e.g. Read)" maxlength="60"><textarea rows="2" placeholder="What to do">${esc(d[2])}</textarea></div><button type="button" class="btn ghost x" data-rmdet="1" aria-label="Remove line">✕</button></li>`}
function addBlock(){
  const list=BY_DATE[sel]||[];let st="16:00";if(list.length){const last=toMin(slot(list[list.length-1]).end);if(last<=1380)st=pad(Math.floor(last/60))+":"+pad(last%60)}
  const enM=Math.min(toMin(st)+60,1439),tr=list.length?list[list.length-1].tr:"other";
  const b={id:"c-"+uid(),d:sel,tr,sub:"Custom",t:"New study block",start:st,end:pad(Math.floor(enM/60))+":"+pad(enM%60),det:[["📝","Task","",null]],subs:[],w:weekFor(tr,sel)};
  S.custom.push(b);newId=b.id;openId=editId=b.id;buildIndex();changed();rerender();scrollRow(b.id);
  requestAnimationFrame(()=>{const t=$("#f-t");if(t){t.focus();t.select()}});
}

/* ---------- Week + Journey lists ---------- */
function dayRow(k){
  const li=document.createElement("li"),list=BY_DATE[k]||[],st=stats(list),d=pkey(k);
  li.className="row"+(k===todayKey()?" cur":"");
  li.innerHTML=`<div class="head"><span class="sw" style="background:${col(list.length?look(list[0]).color:"sand")}">${WEEKDAYS[d.getDay()].slice(0,2)}</span><span class="txt"><span class="t1">${nice(k)}${k===todayKey()?" · today":""}</span><span class="t2">${list.length?`${st.doneN}/${list.length} done`:esc(restText(k))}</span>${list.length?`<span class="minibar"><i style="width:${Math.round(st.pct*100)}%"></i></span>`:""}</span></div>`+
    (list.length?`<div class="day-titles">${list.map(b=>`${S.status[b.id]?STATUS[S.status[b.id]].i:"☐"} ${look(b).emoji} ${esc(b.t)}`).join("<br>")}</div>`:"");
  li.querySelector(".head").addEventListener("click",()=>{sel=k;setTab("today")});
  return li;
}
function weekRow(w){
  const li=document.createElement("li"),list=BY_WEEK[track+"-"+w.n]||[],st=stats(list),T=TRACKS[track],tk=todayKey();
  li.className="row"+(tk>=w.s&&tk<=addDays(w.s,6)?" cur":"");
  li.innerHTML=`<div class="head"><span class="sw" style="background:${col(T.color)}">${w.n}</span><span class="txt"><span class="t1">${esc(w.t)}</span><span class="t2">${nice(w.s)} – ${nice(w.e)} · ${st.doneN}/${st.total} done</span><span class="minibar"><i style="width:${Math.round(st.pct*100)}%"></i></span></span></div>`;
  li.querySelector(".head").addEventListener("click",()=>{sel=w.s;setTab("week")});
  return li;
}

/* ---------- Log: mistakes ---------- */
const SUBJECT_LIST=()=>[...new Set(Object.keys(CONFIG.subjects).filter(s=>!["Capstone","Revision","PYQs","Review","Final revision"].includes(s)).concat(["General Aptitude","Verbal","Quant","Writing","Other"]))];
function logTop(ul,html){const li=document.createElement("li");li.className="logtop";li.innerHTML=html;ul.appendChild(li);return li}
function renderMistakes(ul){
  const redo=S.errors.filter(e=>!e.redo).length;
  const top=logTop(ul,`<p class="meta">${S.errors.length} mistake${S.errors.length===1?"":"s"} logged · ${S.errors.length-redo} re-solved · <b>${redo} to redo</b></p><button type="button" class="btn addbtn" data-add="1">+ Log a mistake</button>`);
  top.querySelector("[data-add]").addEventListener("click",()=>{const m={id:uid(),date:todayKey(),sub:"",src:"",why:"",fix:"",redo:false};S.errors.unshift(m);openId=m.id;changed();rerender()});
  if(!S.errors.length)logTop(ul,`<p class="empty">Every wrong answer goes here: why you got it wrong + the correct idea in one line. Re-solve them on Saturdays. Toppers repeat fewer mistakes.</p>`);
  S.errors.forEach(m=>{
    const li=document.createElement("li"),open=openId===m.id;li.className="row"+(open?" open":"");li.dataset.row=m.id;
    li.innerHTML=`<div class="head"><span class="sw" style="background:${col((CONFIG.subjects[m.sub]||{}).color||"sand")}">${esc((CONFIG.subjects[m.sub]||{}).emoji||"📓")}</span><span class="txt"><span class="t1">${esc(m.sub||"Subject?")} · ${esc(m.src||"source?")}</span><span class="t2">${m.date?nice(m.date):""}${m.fix?" · "+esc(m.fix):""}</span></span><span class="badge ${m.redo?"done":"none"}">${m.redo?"✅ re-solved":"to redo"}</span></div>`;
    if(open){const f=document.createElement("div");f.className="edit";
      f.innerHTML=`<div class="two"><div><label>Date</label><input type="date" data-k="date" value="${esc(m.date)}"></div><div><label>Subject</label><select data-k="sub"><option value="">–</option>${SUBJECT_LIST().map(s=>`<option ${s===m.sub?"selected":""}>${esc(s)}</option>`).join("")}</select></div></div>
        <div><label>Source (paper · question no. / mock / book)</label><input type="text" data-k="src" maxlength="80" value="${esc(m.src)}" placeholder="e.g. GATE 2024 Q12"></div>
        <div><label>Why I got it wrong</label><textarea data-k="why" maxlength="500">${esc(m.why)}</textarea></div>
        <div><label>Correct idea in one line</label><textarea data-k="fix" maxlength="500">${esc(m.fix)}</textarea></div>
        <label class="hab${m.redo?" on":""}"><input type="checkbox" class="chk" data-k="redo" ${m.redo?"checked":""}><span>Re-solved it correctly later</span></label>
        <div class="acts">${confirmId===m.id?`<span>Delete? <button type="button" class="btn" data-del="yes">Yes</button> <button type="button" class="btn ghost" data-del="no">Keep</button></span>`:`<button type="button" class="btn ghost" data-del="ask">🗑 Delete</button>`}<button type="button" class="btn primary" data-close="1">Done</button></div>`;
      bindFields(f,m);bindDel(f,m.id,()=>{S.errors=S.errors.filter(x=>x.id!==m.id)});li.appendChild(f)}
    li.querySelector(".head").addEventListener("click",()=>{openId=open?null:m.id;confirmId=null;rerender()});
    ul.appendChild(li);
  });
}
/* ---------- Log: mock tests ---------- */
function renderMocks(ul){
  const scored=S.mocks.filter(m=>String(m.score).trim()!=="");
  const top=logTop(ul,`<p class="meta">${scored.length}/${S.mocks.length} tests taken${scored.length?" · last: "+esc(scored[scored.length-1].score):""}</p><button type="button" class="btn addbtn" data-add="1">+ Add a test</button>`);
  top.querySelector("[data-add]").addEventListener("click",()=>{const m={id:uid(),t:"New mock test",date:todayKey(),score:"",out:"100",note:""};S.mocks.push(m);openId=m.id;changed();rerender()});
  S.mocks.forEach(m=>{
    const li=document.createElement("li"),open=openId===m.id,done=String(m.score).trim()!=="";li.className="row"+(open?" open":"")+(done?" done":"");li.dataset.row=m.id;
    li.innerHTML=`<div class="head"><span class="sw" style="background:${col(m.tr==="gre"?"lilac":"peach")}">🧪</span><span class="txt"><span class="t1">${esc(m.t)}</span><span class="t2">${m.date?nice(m.date)+" · ":""}${done?`score ${esc(m.score)} / ${esc(m.out)}`:"not taken yet"}</span></span><span class="badge ${done?"done":"none"}">${done?"✅ "+esc(m.score):"to do"}</span></div>`;
    if(open){const f=document.createElement("div");f.className="edit";
      f.innerHTML=`<div><label>Test name</label><input type="text" data-k="t" maxlength="80" value="${esc(m.t)}"></div>
        <div class="two"><div><label>Date taken</label><input type="date" data-k="date" value="${esc(m.date)}"></div><div><label>Out of</label><input type="text" data-k="out" maxlength="20" value="${esc(m.out)}"></div></div>
        <div><label>My score</label><input type="text" data-k="score" maxlength="30" value="${esc(m.score)}" placeholder="e.g. 54.33 or V158 Q165"></div>
        <div><label>Notes (weakest subject, time left, silly mistakes)</label><textarea data-k="note" maxlength="600">${esc(m.note)}</textarea></div>
        <div class="acts">${confirmId===m.id?`<span>Delete? <button type="button" class="btn" data-del="yes">Yes</button> <button type="button" class="btn ghost" data-del="no">Keep</button></span>`:`<button type="button" class="btn ghost" data-del="ask">🗑 Delete</button>`}<button type="button" class="btn primary" data-close="1">Done</button></div>`;
      bindFields(f,m);bindDel(f,m.id,()=>{S.mocks=S.mocks.filter(x=>x.id!==m.id)});li.appendChild(f)}
    li.querySelector(".head").addEventListener("click",()=>{openId=open?null:m.id;confirmId=null;rerender()});
    ul.appendChild(li);
  });
}
/* ---------- Log: checklists ---------- */
function renderLists(ul){
  const top=logTop(ul,`<p class="meta">Everything around the exams: GATE steps, GRE, universities, documents, SOP, resources. Tap a list to open it. Add, rename or delete anything.</p><button type="button" class="btn addbtn" data-add="1">+ New checklist</button>`);
  top.querySelector("[data-add]").addEventListener("click",()=>{const L={id:uid(),name:"New checklist",emoji:"📋",items:[]};S.lists.push(L);openId=L.id;changed();rerender()});
  S.lists.forEach(L=>{
    const li=document.createElement("li"),open=openId===L.id,dn=L.items.filter(i=>i.done).length,pct=L.items.length?dn/L.items.length:0;
    li.className="row"+(open?" open":"");li.dataset.row=L.id;
    li.innerHTML=`<div class="head"><span class="sw" style="background:${col("sun")}">${esc(L.emoji||"📋")}</span><span class="txt"><span class="t1">${esc(L.name)}</span><span class="t2">${dn}/${L.items.length} done</span><span class="minibar"><i style="width:${Math.round(pct*100)}%"></i></span></span></div>`+
      (!open&&L.items.length?`<div class="day-titles">${L.items.slice(0,3).map(i=>(i.done?"☑ ":"☐ ")+esc(i.t)).join("<br>")}${L.items.length>3?"<br>…":""}</div>`:"");
    if(open){const f=document.createElement("div");f.className="edit";
      f.innerHTML=`<div class="two"><div><label>List name</label><input type="text" data-k="name" maxlength="50" value="${esc(L.name)}"></div><div><label>Doodle</label><input type="text" data-k="emoji" maxlength="4" value="${esc(L.emoji)}"></div></div>
        <ul class="items checklist">${L.items.map(it=>`<li data-it="${it.id}"><input type="checkbox" class="chk" ${it.done?"checked":""} aria-label="Done"><div class="detcol"><textarea rows="1" class="ittx" maxlength="200" aria-label="Item">${esc(it.t)}</textarea><textarea rows="1" class="itnote" placeholder="Note / date / link" aria-label="Note">${esc(it.note)}</textarea></div><button type="button" class="btn ghost x" aria-label="Remove item">✕</button></li>`).join("")}</ul>
        <div class="items"><li><input type="text" class="newit" placeholder="Add an item and press Enter" maxlength="120"><button type="button" class="btn x" data-additem="1">Add</button></li></div>
        <div class="acts">${confirmId===L.id?`<span>Delete this whole list? <button type="button" class="btn" data-del="yes">Yes</button> <button type="button" class="btn ghost" data-del="no">Keep</button></span>`:`<button type="button" class="btn ghost" data-del="ask">🗑 Delete list</button>`}<button type="button" class="btn primary" data-close="1">Done</button></div>`;
      bindFields(f,L);bindDel(f,L.id,()=>{S.lists=S.lists.filter(x=>x.id!==L.id)});
      f.querySelectorAll(".checklist li").forEach(row=>{const it=L.items.find(x=>x.id===row.dataset.it);
        row.querySelector(".chk").addEventListener("change",e=>{it.done=e.target.checked;changed();rerender()});
        const tt=row.querySelector(".ittx");tt.addEventListener("input",()=>{it.t=tt.value;grow(tt);changed()});requestAnimationFrame(()=>grow(tt));
        const ta=row.querySelector(".itnote");ta.addEventListener("input",()=>{it.note=ta.value;grow(ta);changed()});requestAnimationFrame(()=>grow(ta));
        row.querySelector("button").addEventListener("click",()=>{L.items=L.items.filter(x=>x.id!==it.id);changed();rerender()})});
      const add=()=>{const i=f.querySelector(".newit"),v=i.value.trim();if(!v)return;L.items.push({id:uid(),t:v,note:"",done:false});changed();rerender();const n=document.querySelector(`[data-row="${L.id}"] .newit`);if(n)n.focus()};
      f.querySelector(".newit").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();add()}});
      f.querySelector("[data-additem]").addEventListener("click",add);
      li.appendChild(f)}
    li.querySelector(".head").addEventListener("click",()=>{openId=open?null:L.id;confirmId=null;rerender()});
    ul.appendChild(li);
  });
}
/* ---------- Log: settings ---------- */
function renderSettings(ul){
  const box=logTop(ul,"");
  const slotRows=Object.keys(CONFIG.slots).map(k=>{const s=(S.slots||{})[k]||CONFIG.slots[k];return `<li class="setrow"><span class="setlbl">${esc(SLOT_NAMES[k]||k)}</span><input type="time" step="300" data-slot="${k}" data-se="start" value="${esc(s.start)}" aria-label="Start"><span>to</span><input type="time" step="300" data-slot="${k}" data-se="end" value="${esc(s.end)}" aria-label="End"></li>`}).join("");
  const cdRows=S.countdowns.map((c,i)=>`<li class="setrow" data-cd="${i}"><input type="text" class="emo-in" data-ck="emoji" value="${esc(c.emoji)}" maxlength="4" aria-label="Doodle"><input type="text" data-ck="label" value="${esc(c.label)}" maxlength="24" aria-label="Name"><input type="date" data-ck="date" value="${esc(c.date)}" aria-label="Date"><button type="button" class="btn ghost x" data-cdrm="${i}" aria-label="Remove">✕</button></li>`).join("");
  const trOpts=Object.keys(PLAN.weeks).map(t=>`<option value="${t}">${esc(TRACKS[t].emoji+" "+TRACKS[t].name)}</option>`).join("");
  box.innerHTML=`<div class="setsec"><h3>⏰ Study times</h3><p class="meta">Change a time here and every day of that block moves. (To change one single day, edit that block.)</p><ul class="items">${slotRows}</ul>${S.slots&&Object.keys(S.slots).length?`<button type="button" class="btn ghost" data-slotreset="1">↺ Back to original times</button>`:""}</div>
    <div class="setsec"><h3>⏳ Countdowns</h3><p class="meta">When your admit card shows your real GATE DA date, change it here.</p><ul class="items">${cdRows}</ul><button type="button" class="btn x" data-cdadd="1">+ Add a countdown</button></div>
    <div class="setsec"><h3>⏩ I'm behind</h3><p class="meta">Pushes every block of one track (from a date onward) forward by some study days. Sundays are skipped. You can undo it.</p>
      <div class="two"><div><label for="sh-tr">Track</label><select id="sh-tr">${trOpts}</select></div><div><label for="sh-from">From date</label><input type="date" id="sh-from" value="${esc(unmarked().length?unmarked()[0].d:todayKey())}"></div></div>
      <div class="two"><div><label for="sh-n">Push by (days)</label><input type="number" id="sh-n" min="1" max="30" value="1"></div><div style="align-self:end"><button type="button" class="btn primary" data-shift="1">Push forward</button></div></div>
      ${S.undo?`<p class="meta">Last push: ${esc(S.undo.what)} <button type="button" class="btn" data-undo="1">↶ Undo it</button></p>`:""}<p class="warn" id="shmsg"></p></div>
    <div class="setsec"><h3>↺ Undo my edits</h3><p class="meta">${Object.keys(S.edits).length} plan block${Object.keys(S.edits).length===1?"":"s"} edited/moved · ${S.custom.length} block${S.custom.length===1?"":"s"} added by you.</p>
      ${confirmId==="resetplan"?`<span>Put every block back to the original plan? Your ticks stay. <button type="button" class="btn" data-resetplan="yes">Yes, reset</button> <button type="button" class="btn ghost" data-resetplan="no">Keep</button></span>`:`<button type="button" class="btn ghost" data-resetplan="ask">Reset the plan to original</button>`}</div>`;
  box.querySelectorAll("[data-slot]").forEach(i=>i.addEventListener("change",()=>{if(!i.value)return;const k=i.dataset.slot;S.slots=S.slots||{};S.slots[k]=Object.assign({},(S.slots[k]||CONFIG.slots[k]),{[i.dataset.se]:i.value});
    if(toMin(S.slots[k].end)<=toMin(S.slots[k].start)){delete S.slots[k];alertMsg("End must be after start.")}buildIndex();changed();rerender()}));
  const sr=box.querySelector("[data-slotreset]");if(sr)sr.addEventListener("click",()=>{S.slots={};buildIndex();changed();rerender()});
  box.querySelectorAll("[data-cd]").forEach(row=>{const c=S.countdowns[+row.dataset.cd];row.querySelectorAll("[data-ck]").forEach(i=>i.addEventListener("input",()=>{c[i.dataset.ck]=i.value;changed();renderNow()}))});
  box.querySelectorAll("[data-cdrm]").forEach(b=>b.addEventListener("click",()=>{S.countdowns.splice(+b.dataset.cdrm,1);changed();rerender()}));
  box.querySelector("[data-cdadd]").addEventListener("click",()=>{S.countdowns.push({emoji:"⭐",label:"New",date:addDays(todayKey(),30)});changed();rerender()});
  box.querySelector("[data-shift]").addEventListener("click",()=>{
    const tr=$("#sh-tr").value,from=$("#sh-from").value,n=Math.max(1,Math.min(60,parseInt($("#sh-n").value,10)||0));
    if(!from){$("#shmsg").textContent="Pick a from-date.";return}
    const hit=BLOCKS.filter(b=>b.tr===tr&&b.d>=from&&!S.status[b.id]);
    if(!hit.length){$("#shmsg").textContent="No unmarked blocks of that track from that date.";return}
    S.undo={what:`${TRACKS[tr].name} from ${nice(from)} by ${n} day${n>1?"s":""}`,edits:clone(S.edits),custom:clone(S.custom)};
    hit.forEach(b=>{const nd=addStudyDays(b.d,n);if(isPlan(b.id))S.edits[b.id]=Object.assign({},S.edits[b.id]||{},{d:nd});else S.custom.find(c=>c.id===b.id).d=nd});
    buildIndex();changed();const lastD=hit.map(b=>addStudyDays(b.d,n)).sort().pop(),firstD=hit.map(b=>b.d).sort()[0];
    const past=S.countdowns.find(c=>c.date&&firstD<c.date&&lastD>=c.date);
    msgFlash(`Moved ${hit.length} blocks. Last one now on ${nice(lastD)}.`+(past?` ⚠️ Some now fall on/after ${past.label} (${nice(past.date)}): check the last week.`:""));rerender()});
  const un=box.querySelector("[data-undo]");if(un)un.addEventListener("click",()=>{S.edits=S.undo.edits;S.custom=S.undo.custom;delete S.undo;buildIndex();changed();rerender()});
  box.querySelectorAll("[data-resetplan]").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.resetplan;
    if(v==="ask")confirmId="resetplan";else if(v==="no")confirmId=null;else{S.undo={what:"plan reset",edits:clone(S.edits),custom:clone(S.custom)};S.edits={};S.custom=[];confirmId=null;buildIndex();changed()}rerender()}));
}
function alertMsg(t){status(t);clearTimeout(timer);timer=setTimeout(()=>status(""),t.length>60?6000:2500)}
function msgFlash(t){alertMsg(t)}
function bindFields(f,obj){
  f.querySelectorAll("[data-k]").forEach(i=>{const k=i.dataset.k;
    const ev=i.type==="checkbox"||i.tagName==="SELECT"||i.type==="date"?"change":"input";
    i.addEventListener(ev,()=>{obj[k]=i.type==="checkbox"?i.checked:i.value;changed();if(ev==="change")rerender()});
    if(i.tagName==="TEXTAREA"){i.addEventListener("input",()=>grow(i));requestAnimationFrame(()=>grow(i))}});
  const c=f.querySelector("[data-close]");if(c)c.addEventListener("click",()=>{openId=null;confirmId=null;rerender()});
}
function bindDel(f,id,remove){f.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.del;
  if(v==="ask")confirmId=id;else if(v==="no")confirmId=null;else{remove();openId=null;confirmId=null;changed()}rerender()}))}

/* ---------- side list ---------- */
function renderList(){
  const ul=$("#rows");ul.innerHTML="";const tk=todayKey();
  const chips=tab==="journey"?Object.keys(PLAN.weeks).map(t=>`<button type="button" class="chip" data-track="${t}" aria-pressed="${t===track}">${TRACKS[t].emoji} ${esc(TRACKS[t].name)}</button>`).join("")
    :tab==="log"?[["mistakes","📓 Mistakes"],["mocks","🧪 Mocks"],["lists","✅ Checklists"],["settings","⚙️ Settings"]].map(([k,t])=>`<button type="button" class="chip" data-sec="${k}" aria-pressed="${k===logSec}">${t}</button>`).join(""):"";
  $("#chips").innerHTML=chips;
  $("#prevBtn").hidden=$("#nextBtn").hidden=tab==="journey"||tab==="log";
  $("#addBlock").hidden=tab!=="today";
  if(tab==="today"){
    $("#listTitle").textContent=(sel===tk?"Today · ":"")+nice(sel);$("#goToday").hidden=sel===tk;
    const list=BY_DATE[sel]||[];
    if(!list.length)ul.innerHTML=`<li class="empty">${esc(restText(sel))}</li>`;
    list.forEach(b=>ul.appendChild(blockRow(b)));
    $("#hint").textContent="Tap a block to see the full task, tick the steps and mark it. ✏️ Edit block changes anything: title, time, date, task, steps. ‹ › shows other days.";
  }else if(tab==="week"){
    const mon=mondayOf(sel);$("#listTitle").textContent="Week of "+nice(mon);$("#goToday").hidden=mon===mondayOf(tk);
    for(let i=0;i<7;i++)ul.appendChild(dayRow(addDays(mon,i)));
    $("#hint").textContent="Tap a day to open it. The green fill on the wheel grows as you tick blocks.";
  }else if(tab==="journey"){
    $("#listTitle").textContent=TRACKS[track].name+" journey";$("#goToday").hidden=true;
    (PLAN.weeks[track]||[]).forEach(w=>ul.appendChild(weekRow(w)));
    $("#hint").textContent="Every week of this track. Tap a week to see its days.";
  }else{
    $("#listTitle").textContent="My log";$("#goToday").hidden=true;
    ({mistakes:renderMistakes,mocks:renderMocks,lists:renderLists,settings:renderSettings})[logSec](ul);
    $("#hint").textContent={mistakes:"Tip: inside any study block, '📓 Log a mistake' opens a new entry already filled with the subject.",mocks:"Your planned mock tests are already listed. Type your score after each one.",lists:"These lists replace the Word and Excel files.",settings:"Bigger changes (colours, doodles, subjects) live in config.js on GitHub."}[logSec];
  }
}
function scrollRow(id){requestAnimationFrame(()=>{const r=document.querySelector(`[data-row="${id}"]`);if(r)r.scrollIntoView({block:"nearest",behavior:"smooth"})})}

function grow(t){t.style.height="auto";t.style.height=t.scrollHeight+"px"}
function renderNotes(){
  const ul=$("#notesList");ul.innerHTML="";const ns=S.sticky;
  if(!ns.length){ul.innerHTML=`<li class="empty-notes">No notes yet. Tap "+ Add note" for quick reminders.</li>`;return}
  ns.forEach((n,i)=>{
    const li=document.createElement("li");li.className="sticky";li.style.setProperty("--tilt",(i%2?1.1:-1.1)+"deg");
    li.innerHTML=`<span class="star">★</span><textarea rows="1" id="note-${n.id}" maxlength="300" aria-label="Note" placeholder="Write a note">${esc(n.t)}</textarea><button type="button" class="btn ghost x" aria-label="Delete note">${delNote===n.id?"Delete?":"✕"}</button>`;
    const ta=li.querySelector("textarea"),b=li.querySelector("button");
    ta.addEventListener("input",()=>{n.t=ta.value;grow(ta);changed()});
    b.addEventListener("click",()=>{if(!n.t.trim()||delNote===n.id){S.sticky=ns.filter(x=>x.id!==n.id);delNote=null;changed()}else delNote=n.id;renderNotes()});
    ul.appendChild(li);requestAnimationFrame(()=>grow(ta));
  });
}
/* ---------- date bar + calendar ---------- */
let calMonth=null;
function renderDatebar(){
  const show=tab==="today"||tab==="week";$("#datebar").hidden=!show;
  const tk=todayKey(),past=tab==="today"&&sel<tk;
  $("#pastNote").hidden=!past;if(past)$("#pastNote").textContent=`🕰️ You're looking at ${nice(sel)}. Tick, edit or add anything here, it all saves.`;
  if(!show)return;
  $("#dateLbl").textContent=tab==="week"?"Week of "+nice(mondayOf(sel)):(sel===tk?"Today · ":"")+nice(sel);
  $("#dToday").hidden=tab==="week"?mondayOf(sel)===mondayOf(tk):sel===tk;
  $("#dPrev").setAttribute("aria-label",tab==="week"?"Previous week":"Previous day");$("#dNext").setAttribute("aria-label",tab==="week"?"Next week":"Next day");
}
function calOpen(){calMonth=sel.slice(0,8)+"01";renderCal();$("#calPop").hidden=false;$("#calBack").hidden=false;const s=document.querySelector(".cday.sel");if(s)s.focus()}
function calClose(){$("#calPop").hidden=true;$("#calBack").hidden=true}
function renderCal(){
  const first=pkey(calMonth),y=first.getFullYear(),m=first.getMonth(),days=new Date(y,m+1,0).getDate(),lead=(first.getDay()+6)%7,tk=todayKey();
  let h=`<div class="calhead"><button type="button" class="btn navbtn" data-cm="-1" aria-label="Previous month">‹</button><h2>${MONTHS[m]} ${y}</h2><button type="button" class="btn navbtn" data-cm="1" aria-label="Next month">›</button><button type="button" class="btn ghost x" data-cclose="1" aria-label="Close">✕</button></div><div class="calgrid">`;
  h+=["Mo","Tu","We","Th","Fr","Sa","Su"].map(d=>`<span class="cwd">${d}</span>`).join("");
  for(let i=0;i<lead;i++)h+=`<span></span>`;
  for(let d=1;d<=days;d++){const k=y+"-"+pad(m+1)+"-"+pad(d),list=BY_DATE[k]||[],st=stats(list),pct=Math.round(st.pct*100),miss=k<tk&&list.some(b=>!S.status[b.id]);
    h+=`<button type="button" class="cday${k===tk?" today":""}${k===sel?" sel":""}${list.length?"":" free"}${miss?" miss":""}" data-cday="${k}" aria-label="${nice(k)}${list.length?`, ${st.doneN} of ${list.length} done`:""}"><span class="cnum">${d}</span>${list.length?`<span class="cpie" style="--p:${pct}%"></span>`:`<span class="crest">${pkey(k).getDay()===0?"😴":""}</span>`}</button>`}
  h+=`</div><div class="calleg"><span><span class="cpie" style="--p:60%"></span>fills as you tick</span><span><i class="mdot"></i>has unticked blocks</span><span>😴 Sunday</span></div><div class="acts" style="justify-content:center;margin-top:8px"><button type="button" class="btn" data-cm="0">Go to today</button></div>`;
  $("#calPop").innerHTML=h;
}
function stepDate(dir){sel=addDays(sel,(tab==="week"?7:1)*dir);openId=editId=null;rerender()}
function rerender(){renderDatebar();renderNow();renderList();drawWheel()}
function render(){
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===tab));
  const who=$("#who");if(document.activeElement!==who)who.value=S.name||"My";sizeWho();
  const d=new Date();$("#todayDate").textContent=WEEKDAYS[d.getDay()]+", "+d.getDate()+" "+MONTHS[d.getMonth()]+" "+d.getFullYear();
  rerender();renderNotes();
}
function setTab(t,keepOpen){tab=t;if(!keepOpen)openId=null;editId=null;confirmId=null;try{localStorage.setItem(LS+"-tab",tab)}catch(e){}render();if(!keepOpen)window.scrollTo({top:0,behavior:"smooth"})}
function sizeWho(){const w=$("#who");w.style.width=Math.max(1,(w.value||"").length)+.6+"ch"}

/* ---------- saving ---------- */
function status(m){const p=$("#savePill");p.hidden=!m;$("#saveMsg").textContent=m||""}
function changed(){
  S.updatedAt=Date.now();
  try{localStorage.setItem(LS,JSON.stringify(S));status("Saved ✓")}catch(e){status("Couldn't save in this browser")}
  clearTimeout(timer);timer=setTimeout(()=>status(""),1500);
}

/* ---------- events ---------- */
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
$("#prevBtn").addEventListener("click",()=>{sel=addDays(sel,tab==="week"?-7:-1);openId=editId=null;rerender()});
$("#nextBtn").addEventListener("click",()=>{sel=addDays(sel,tab==="week"?7:1);openId=editId=null;rerender()});
$("#goToday").addEventListener("click",()=>{sel=todayKey();openId=editId=null;rerender()});
$("#addBlock").addEventListener("click",addBlock);
$("#dPrev").addEventListener("click",()=>stepDate(-1));
$("#dNext").addEventListener("click",()=>stepDate(1));
$("#dToday").addEventListener("click",()=>{sel=todayKey();openId=editId=null;rerender()});
$("#dateBtn").addEventListener("click",calOpen);
$("#calBack").addEventListener("click",calClose);
$("#calPop").addEventListener("click",e=>{
  const c=e.target.closest("[data-cday]");if(c){sel=c.dataset.cday;calClose();setTab("today");return}
  const m=e.target.closest("[data-cm]");if(m){const v=+m.dataset.cm;if(v===0){sel=todayKey();calClose();setTab("today");return}const d=pkey(calMonth);d.setMonth(d.getMonth()+v);calMonth=dkey(d);renderCal();return}
  if(e.target.closest("[data-cclose]"))calClose();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#calPop").hidden)calClose()});
$("#chips").addEventListener("click",e=>{const c=e.target.closest("[data-track],[data-sec]");if(!c)return;if(c.dataset.track)track=c.dataset.track;else{logSec=c.dataset.sec;openId=null;confirmId=null}rerender()});
$("#who").addEventListener("input",e=>{S.name=e.target.value.slice(0,14);sizeWho();changed()});
$("#addNote").addEventListener("click",()=>{const n={id:uid(),t:""};S.sticky.push(n);delNote=null;renderNotes();const t=document.getElementById("note-"+n.id);if(t)t.focus()});
function goFrom(t){sel=t.dataset.go;openId=t.dataset.open||null;editId=null;if(tab!=="today")setTab("today",true);else rerender();if(openId)scrollRow(openId)}
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-go]");if(t){goFrom(t);return}
  if(e.target.closest("[data-behind]")){logSec="settings";setTab("log");requestAnimationFrame(()=>{const s=$("#sh-tr");if(s)s.scrollIntoView({block:"center",behavior:"smooth"})})}
});
document.addEventListener("keydown",e=>{const t=e.target.closest&&e.target.closest(".dot[data-go]");if(t&&(e.key==="Enter"||e.key===" ")){e.preventDefault();goFrom(t)}});
document.addEventListener("change",e=>{
  const c=e.target.closest&&e.target.closest(".hchk");if(!c)return;
  const id=c.dataset.b,i=+c.dataset.i,b=blockById(id);if(!b)return;
  const on=new Set(S.subs[id]||[]);c.checked?on.add(i):on.delete(i);
  if(on.size)S.subs[id]=[...on];else delete S.subs[id];
  const cur=S.status[id];
  if(on.size===b.subs.length)S.status[id]="done";
  else if(on.size)S.status[id]="partly";
  else if(cur==="done"||cur==="partly")delete S.status[id];
  changed();rerender();
});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&S)tick(true)});
function tick(force){
  const tk=todayKey();if(tk!==lastToday){if(sel===lastToday)sel=tk;lastToday=tk;force=true}
  if(editId||(tab==="log"&&!force))return;
  if(force||!openId){renderNow();if(tab!=="journey"||force)drawWheel()}
}
setInterval(()=>{if(S&&!document.hidden)tick(false)},60000);

/* ---------- backup ---------- */
$("#exportBtn").addEventListener("click",()=>{
  const b=new Blob([JSON.stringify(S,null,1)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download="study-pie-backup-"+todayKey()+".json";document.body.appendChild(a);a.click();a.remove();
  $("#backupMsg").textContent="Backup downloaded to your Downloads folder.";
});
$("#importFile").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d||typeof d.status!=="object")throw 0;localStorage.setItem(LS,JSON.stringify(d));location.reload()}
    catch(err){$("#backupMsg").textContent="That file isn't a Study Pie backup."}};r.readAsText(f);
});

/* ---------- boot ---------- */
function boot(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem(LS)||"null")}catch(e){}
  S=saved||{name:"My"};
  S.status=S.status||{};S.subs=S.subs||{};S.bnotes=S.bnotes||{};S.sticky=Array.isArray(S.sticky)?S.sticky:[];
  S.edits=S.edits||{};S.custom=Array.isArray(S.custom)?S.custom:[];S.errors=Array.isArray(S.errors)?S.errors:[];S.slots=S.slots||{};
  if(!Array.isArray(S.lists))S.lists=(PLAN.lists||[]).map(L=>({id:uid(),name:L.name,emoji:L.emoji,items:L.items.map(i=>({id:uid(),t:i.t,note:i.note||"",done:false}))}));
  if(!Array.isArray(S.mocks))S.mocks=(PLAN.mocks||[]).map(m=>({id:uid(),t:m.t,tr:m.tr,date:"",score:"",out:m.out,note:""}));
  if(!Array.isArray(S.countdowns))S.countdowns=clone(CONFIG.countdowns);
  buildIndex();
  const tk=todayKey(),todays=BY_DATE[tk]||[];
  track=todays.length&&PLAN.weeks[todays[todays.length-1].tr]?todays[todays.length-1].tr:(tk>"2027-02-21"?"gre":"gate");
  render();
}
boot();

/* ---------- install as an app ---------- */
let installEvt=null;const instBtn=$("#installBtn");
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;instBtn.hidden=false});
instBtn.addEventListener("click",async()=>{if(!installEvt)return;installEvt.prompt();await installEvt.userChoice;installEvt=null;instBtn.hidden=true});
window.addEventListener("appinstalled",()=>{instBtn.hidden=true});
if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
