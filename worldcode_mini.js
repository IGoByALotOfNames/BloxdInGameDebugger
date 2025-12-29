var dbg=null;class JSDebugger{constructor(cs,p){this.p=p;this.o=cs;if(typeof cs!=='string'){this.l=[]}else{this.l=cs.split('\n')}this.t="crosshairText";this.k=20;this.s="ANALYZING";this.x=0;this.b="";this.v=[];this.u=[];this.d=0;this.g=null;this.i=null;this.f=false;this.e=false;this.m="";this.j("Initializing...")}update(){if(this.s==="READY"||this.s==="ERROR")return;try{if(this.s==="ANALYZING")this.a();else if(this.s==="INSTRUMENTING")this.n();else if(this.s==="COMPILING")this.c()}catch(e){console.log("Debugger Crash: "+e);this.h("Init Error: "+e.message)}}h(m){this.e=true;this.m=m;this.s="ERROR";this.y()}a(){this.u=this.ef(this.o);this.v=this.ev(this.o);this.s="INSTRUMENTING";this.x=0;this.b="";this.d=0;this.j("Analyzing...")}n(){let ct=0;while(ct<this.k&&this.x<this.l.length){const ln=this.l[this.x];if(typeof ln==='string')this.r(ln,this.x);this.x++;ct++}if(this.x>=this.l.length){this.s="COMPILING";this.j("Compiling...")}else{let pct=Math.floor((this.x/this.l.length)*100);this.j(`Instrumenting... ${pct}%`)}}r(ln,idx){let pl=ln;const lno=idx+1;let cc="";try{cc=ln.replace(/"[^"]*"|'[^']*'|`[^`]*`/g,'').replace(/\/\/.*|\/\*[\s\S]*?\*\//g,'')}catch(e){cc=""}const ob=(cc.match(/\{/g)||[]).length;const cb=(cc.match(/\}/g)||[]).length;if(this.u&&this.u.length>0){this.u.forEach(fn=>{try{const dr=new RegExp(`function\\s+${fn}\\b`);if(dr.test(pl))pl=pl.replace(dr,`function* ${fn}`);if(!pl.includes(`function* ${fn}`)){const cr=new RegExp(`\\b${fn}\\s*\\(`,`g`);pl=pl.replace(cr,`yield* ${fn}(`)}}catch(e){}})}const to=`{ l:${lno}, d:${this.d}, scope:function(s){try{return eval(s)}catch(e){return undefined}} }`;this.b+=`yield ${to};\n${pl}\n`;this.d+=ob-cb}c(){try{const GF=Object.getPrototypeOf(function*(){}).constructor;this.g=new GF(this.b)();this.s="READY";this.z()}catch(e){throw new Error("Syntax Error/OOM: "+e.message)}}z(){this.q();const bl=this.l.findIndex(l=>l.includes("//BREAK"))+1;if(bl>0){let sf=0;while(!this.f&&!this.e&&this.i.l<bl&&sf<2000){this.q();sf++}}this.w()}q(){if(this.f||this.e)return;try{const res=this.g.next();if(res.done){this.f=true;this.i=null}else{this.i=res.value}}catch(e){this.e=true;let msg=String(e);if(msg.length>60)msg=msg.substring(0,60)+"...";this.m=msg;this.w()}}step(){if(this.s==="READY")this.stepInto()}stepInto(){if(this.f||this.e)return;this.q();this.w()}stepOver(){if(this.s!=="READY"||this.f||this.e)return;const sd=this.i?this.i.d:0;this.q();let sf=0;while(!this.f&&!this.e&&this.i&&this.i.d>sd&&sf<1000){this.q();sf++}this.w()}w(){this.y()}y(){if(!this.l||this.l.length===0)return;const VS=20;const HV=10;let cl=1;if(this.i)cl=this.i.l;else if(this.f)cl=this.l.length;let si=0;if(this.l.length>VS){si=cl-HV;if(si<0)si=0;if(si+VS>this.l.length)si=this.l.length-VS}const ei=Math.min(si+VS,this.l.length);let bt="",ct="",at="";for(let i=si;i<ei;i++){const lno=i+1;const it=(lno===cl&&!this.f);let mk="|";if(it)mk=this.e?"✖":"▷";const ns=lno.toString().padStart(3," ");const fl=`${ns} ${mk}  ${this.l[i]}\n`;if(lno<cl)bt+=fl;else if(it){ct+=fl;if(this.e)ct+=`    ↳ [ERR] ${this.m}\n`}else at+=fl}const pld=[];if(bt)pld.push({str:bt,style:{color:"#AAAAAA",opacity:0.8}});if(ct){const c=this.e?"#FF5555":"#FFFF55";pld.push({str:ct,style:{color:c,fontWeight:"bold"}})}if(this.f)pld.push({str:"\n-- FINISHED --\n",style:{color:"#00FF00"}});if(at)pld.push({str:at,style:{color:"#AAAAAA",opacity:0.8}});if(typeof api!=='undefined'&&typeof api.setClientOption==='function'){api.setClientOption(this.p,this.t,pld)}}info(){if(this.s!=="READY"||!this.i||this.f)return;try{let as="";const rl=this.l[this.i.l-1].trim();const lp=rl.replace(/^(\}\s*)?(else\s*)?/,"").trim();if(lp.startsWith("if")){const ii=rl.indexOf("if");const opi=rl.indexOf("(",ii);const cpi=rl.lastIndexOf(")");if(ii!==-1&&opi!==-1&&cpi>opi){const cstr=rl.substring(opi+1,cpi);try{const br=this.i.scope(cstr);let dc="";const pts=cstr.split(/\s*(===|==|!==|!=|<=|>=|<|>)\s*/);if(pts.length===3){const lh=pts[0];const op=pts[1];const rh=pts[2];let lv=this.i.scope(lh);if(typeof lv==='string')lv=`"${lv}"`;else if(Array.isArray(lv))lv=`[Array]`;let rv=this.i.scope(rh);if(typeof rv==='string')rv=`"${rv}"`;else if(Array.isArray(rv))rv=`[Array]`;dc=`${lv} ${op} ${rv}`}else{dc=cstr;this.v.forEach(v=>{const rx=new RegExp(`\\b${v}\\b`,'g');if(rx.test(dc)){let val=this.i.scope(v);if(typeof val==='string')val=`"${val}"`;if(String(val).length<15){dc=dc.replace(rx,String(val))}}})}as+=`[IF CHECK] ${dc}: ${br}\n----------------\n`}catch(e){as+=`[IF CHECK] (Eval Error): error\n----------------\n`}}}this.v.forEach(vn=>{let v=undefined;try{v=this.i.scope(vn)}catch(e){return}if(v===undefined)return;let dv=v;if(typeof v==='function')dv="[Function]";else if(typeof v==='object'&&v!==null){try{let s=JSON.stringify(v);if(s.length>30)dv=s.substring(0,30)+"...";else dv=s}catch(e){dv="[Obj]"}}else{let s=String(v);if(s.length>30)dv=s.substring(0,30)+"...";else dv=s}as+=`${vn}: ${dv}\n`});if(!as)as="No vars";if(typeof api!=='undefined'&&typeof api.setClientOption==='function'){api.setClientOption(this.p,"RightInfoText",[{str:as}])}}catch(e){}}j(txt){if(typeof api!=='undefined'&&typeof api.setClientOption==='function'){api.setClientOption(this.p,this.t,[{str:`[DEBUGGER]\n${txt}`,style:{color:"#FFFF00"}}])}}ef(c){if(!c)return[];const m=c.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g)||[];return m.map(m=>m.replace(/function\s+|\s*\(/g,'').trim())}ev(c){if(!c)return[];const k=new Set(['var','let','const','if','else','for','while','do','break','continue','function','return','try','catch','finally','switch','case','default','class','extends','new','this','super','import','export','from','void','typeof','in','instanceof','yield','await','async','throw','debugger','null','true','false','undefined','NaN','Infinity','api','console','Math','Object','Array','String','Number','window','global']);let cc="";try{cc=c.replace(/"[^"]*"|'[^']*'|`[^`]*`/g,'').replace(/\/\/.*|\/\*[\s\S]*?\*\//g,'')}catch(e){return[]}const m=cc.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g)||[];return[...new Set(m)].filter(m=>!k.has(m))}}
function tick() {
    try {
        if (dbg) dbg.update();
    } catch (e) {}
}


function playerCommand(id,cmd){
  if (cmd==="init"){
	api.giveItem(id, "Moonstone Fragment", null, {customDisplayName: "Step"})
	api.giveItem(id, "Diamond Fragment", null, {customDisplayName: "Step Over"})
    dbg = new JSDebugger(rawCode, id);
    
    return true
  }else if (cmd==="info"){
	if (dbg) { dbg.info(); }
    return true
  }else if (cmd==="step"){
    if (dbg) { dbg.step(); dbg.info(); }
    return true
  }else if (cmd==="clear"){
	api.setClientOption(id, "crosshairText", "")
	api.setClientOption(id, "RightInfoText", "")
	
	return true
  }
}
function onPlayerAltAction(id){
	itm=api.getItemSlot(id, api.getSelectedInventorySlotI(id))
	if (itm.attributes.customDisplayName === "Step" && dbg){
		dbg.step()
		dbg.info()
	}else if (itm.attributes.customDisplayName === "Step Over" && dbg){
		dbg.stepOver()
		dbg.info()
	}
	
}
