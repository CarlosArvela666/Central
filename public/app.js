/*
  ============================================================
  LÓGICA (JavaScript) - Central de Aplicações
  Feito por: Carlos Arvela
  Inclui: login de admin, gestão de sites e editor de manuais.
  Idealizado e criado por Carlos Arvela.
  ============================================================
*/
(function(){
var state={sites:[],manuals:[]};
var admin=false,loaded=false;
var modal=null,toastMsg='',busy=false;
var route=(location.hash==='#/manuais')?'man':'sites';
var curMan=null,curCh=0;
var $=function(s,r){return (r||document).querySelector(s)};
var IC={
  grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  book:'<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19V5.5"/><path d="M9 8h7"/></svg>',
  out:'<svg viewBox="0 0 24 24"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>',
  arr:'<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uid(){return 'x'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)}
function inline(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`(.+?)`/g,'<code>$1</code>')}
function fmt(t){var out=[],list=null;
  function close(){if(list){out.push('</'+list+'>');list=null}}
  String(t||'').split('\n').forEach(function(l){l=l.replace(/\s+$/,'');var m;
    if((m=l.match(/^\d+[.)]\s+(.*)/))){if(list!=='ol'){close();out.push('<ol>');list='ol'}out.push('<li>'+inline(m[1])+'</li>')}
    else if((m=l.match(/^[-•]\s+(.*)/))){if(list!=='ul'){close();out.push('<ul>');list='ul'}out.push('<li>'+inline(m[1])+'</li>')}
    else if((m=l.match(/^>\s?(.*)/))){close();out.push('<div class="note">'+inline(m[1])+'</div>')}
    else if(!l.trim()){close()}
    else{close();out.push('<p>'+inline(l)+'</p>')}
  });close();return out.join('')}
function mono(n){var w=String(n).trim().split(/\s+/);var a=(w[0]||'?')[0]+((w[1]||w[0]||'?')[w[1]?0:1]||'');return a.toUpperCase()}
function tile(n){var h=0,s=String(n);for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return 'background:linear-gradient(135deg,hsl('+h+' 68% 56%),hsl('+((h+42)%360)+' 70% 44%))'}
function ct(t){return String(t).replace(/^\d+[.)]\s*/,'')}
function normUrl(u){u=String(u||'').trim();if(!u)return '';if(!/^https?:\/\//i.test(u))u='https://'+u;try{var x=new URL(u);return (x.protocol==='http:'||x.protocol==='https:')?x.href:''}catch(e){return ''}}
function find(list,id){return list.filter(function(x){return x.id===id})[0]}
function pl(n,a,b){return n+' '+(n===1?a:b)}

function render(){
  if(!loaded){$('#app').innerHTML='<div class="page"><div class="empty">A carregar…</div></div>';return}
  var q=($('#q').value||'').trim().toLowerCase();
  var reader=route==='man'&&curMan&&find(state.manuals,curMan);
  if(route==='man'&&curMan&&!reader)curMan=null;
  $('#admbtn').textContent=admin?'Sair de admin':'Entrar como admin';
  $('#admbtn').setAttribute('data-act',admin?'logout':'login');
  $('#nav').innerHTML='<button data-act="go" data-r="sites" class="'+(route==='sites'?'on':'')+'">'+IC.grid+'<span>Sites</span><em>'+state.sites.length+'</em></button><button data-act="go" data-r="man" class="'+(route==='man'?'on':'')+'">'+IC.book+'<span>Manuais</span><em>'+state.manuals.length+'</em></button>';
  $('#bar').hidden=!!reader;
  $('#q').placeholder=route==='sites'?'Pesquisar aplicação…':'Pesquisar manual…';
  var sites=state.sites.filter(function(s){return !q||(s.n+' '+s.d+' '+s.c).toLowerCase().indexOf(q)>-1});
  var mans=state.manuals.filter(function(m){return !q||(m.t+' '+(m.d||'')+' '+m.ch.map(function(c){return c.t+' '+c.b}).join(' ')).toLowerCase().indexOf(q)>-1});
  $('#count').textContent=route==='sites'?pl(sites.length,'resultado','resultados'):pl(mans.length,'resultado','resultados');
  var h='<div class="page">';
  if(reader){
    var m=reader;if(curCh>=m.ch.length)curCh=m.ch.length-1;if(curCh<0)curCh=0;var c=m.ch[curCh];
    h+='<div class="crumb"><button data-act="closeman">'+IC.back+' Todos os manuais</button></div><div class="reader"><nav class="toc"><p class="toc-t">'+esc(m.t)+'</p><p class="toc-s">'+pl(m.ch.length,'capítulo','capítulos')+'</p>';
    m.ch.forEach(function(x,i){h+='<button data-act="ch" data-i="'+i+'" class="'+(i===curCh?'on':'')+'"><b>'+(i+1)+'</b><span>'+esc(ct(x.t))+'</span></button>'});
    h+='</nav><article class="art">';
    if(admin)h+='<div class="rt"><button class="btn sm" data-act="editman" data-id="'+m.id+'">Editar manual</button><button class="btn sm dng" data-act="delman" data-id="'+m.id+'">Remover</button></div>';
    h+='<div class="kick">Capítulo '+(curCh+1)+' de '+m.ch.length+'</div><h2>'+esc(ct(c.t))+'</h2><div class="prose">'+fmt(c.b)+'</div><div class="pn">'+(curCh>0?'<button class="btn" data-act="prev">'+IC.back+' Anterior</button>':'<span></span>')+(curCh<m.ch.length-1?'<button class="btn pri" data-act="next">Seguinte '+IC.arr+'</button>':'<button class="btn" data-act="closeman">Concluir</button>')+'</div></article></div>';
  }else if(route==='sites'){
    var cats=[];state.sites.forEach(function(s){if(cats.indexOf(s.c)<0)cats.push(s.c)});
    h+='<div class="ph"><div><h1>Aplicações</h1><p>Acede rapidamente a todas as tuas ferramentas, organizadas por área.</p></div><div class="phact">'+(admin?'<span class="badge">Modo admin</span><button class="btn pri" data-act="newsite">'+IC.plus+' Novo site</button>':'')+'</div></div>';
    h+='<div class="stats"><div class="stat"><b>'+state.sites.length+'</b><span>Aplicações</span></div><div class="stat"><b>'+cats.length+'</b><span>Categorias</span></div><div class="stat"><b>'+state.manuals.length+'</b><span>Manuais</span></div></div>';
    var shown=[];sites.forEach(function(s){if(shown.indexOf(s.c)<0)shown.push(s.c)});
    shown.forEach(function(cg){
      var list=sites.filter(function(s){return s.c===cg});
      h+='<section class="cat"><h2>'+esc(cg)+' <i>'+list.length+'</i></h2><div class="grid">';
      list.forEach(function(s){
        h+='<div class="cw"><a class="card" href="'+esc(s.u)+'" target="_blank" rel="noopener"><div class="top"><div class="mono" style="'+tile(s.n)+'">'+esc(mono(s.n))+'</div><span class="go">'+IC.out+'</span></div><div><h3>'+esc(s.n)+'</h3><p>'+esc(s.d)+'</p></div><span class="chip">'+esc(s.c)+'</span></a>';
        if(admin)h+='<div class="ct"><button class="btn sm" data-act="editsite" data-id="'+s.id+'">Editar</button><button class="btn sm dng" data-act="delsite" data-id="'+s.id+'">Remover</button></div>';
        h+='</div>';
      });
      h+='</div></section>';
    });
    if(!sites.length)h+='<div class="empty">'+IC.grid+'<div>'+(q?'Nada encontrado para esta pesquisa.':'Ainda não há sites.'+(admin?' Usa «Novo site» para adicionar o primeiro.':''))+'</div></div>';
  }else{
    h+='<div class="ph"><div><h1>Manuais de instrução</h1><p>Guias passo a passo de cada aplicação. Escolhe um manual para começar a ler.</p></div><div class="phact">'+(admin?'<span class="badge">Modo admin</span><button class="btn pri" data-act="newman">'+IC.plus+' Novo manual</button>':'')+'</div></div><div class="grid">';
    mans.forEach(function(m){
      h+='<div class="cw"><button class="card" data-act="openman" data-id="'+m.id+'"><div class="top"><div class="mono" style="'+tile(m.t)+'">'+esc(mono(m.t))+'</div><span class="go">'+IC.arr+'</span></div><div><h3>'+esc(m.t)+'</h3><p>'+(m.d?esc(m.d):'Manual de utilização')+'</p></div><span class="chip">'+pl(m.ch.length,'capítulo','capítulos')+'</span></button>';
      if(admin)h+='<div class="ct"><button class="btn sm" data-act="editman" data-id="'+m.id+'">Editar</button><button class="btn sm dng" data-act="delman" data-id="'+m.id+'">Remover</button></div>';
      h+='</div>';
    });
    h+='</div>';
    if(!mans.length)h+='<div class="empty">'+IC.book+'<div>'+(q?'Nada encontrado para esta pesquisa.':'Ainda não há manuais.'+(admin?' Usa «Novo manual» para criar o primeiro.':''))+'</div></div>';
  }
  h+='</div>'+modalHtml();
  if(toastMsg)h+='<div class="toast">'+esc(toastMsg)+'</div>';
  $('#app').innerHTML=h;
}

function modalHtml(){
  if(!modal)return '';
  var m=modal,h='<div class="ov"><div class="md'+(m.t==='man'?' wide':'')+'">';
  if(m.t==='login'){
    h+='<h3>Entrar como administrador</h3><label class="f">Utilizador<input id="lu" autocomplete="username" autocapitalize="off"></label><label class="f">Palavra-passe<input id="lp" type="password" autocomplete="current-password"></label><p class="err">'+esc(m.err||'')+'</p><div class="acts"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="dologin">Entrar</button></div>';
  }else if(m.t==='site'){
    var s=m.d,cats=[];state.sites.forEach(function(x){if(cats.indexOf(x.c)<0)cats.push(x.c)});
    h+='<h3>'+(s.id?'Editar site':'Novo site')+'</h3><label class="f">Nome<input id="sn" value="'+esc(s.n)+'"></label><label class="f">Endereço (URL)<input id="su" value="'+esc(s.u)+'" placeholder="https://…" inputmode="url" autocapitalize="off"></label><label class="f">Categoria<input id="sc" list="cl" value="'+esc(s.c)+'" placeholder="Escolhe ou escreve uma nova"><datalist id="cl">'+cats.map(function(c){return '<option value="'+esc(c)+'">'}).join('')+'</datalist></label><label class="f">Descrição curta<input id="sd" value="'+esc(s.d)+'"></label><p class="err">'+esc(m.err||'')+'</p><div class="acts"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="savesite">'+(busy?'A guardar…':'Guardar')+'</button></div>';
  }else if(m.t==='man'){
    var d=m.d;
    h+='<h3>'+(d.id?'Editar manual':'Novo manual')+'</h3><label class="f">Título<input id="mt" value="'+esc(d.t)+'" placeholder="ex.: Diário de Trabalho"></label><label class="f">Descrição curta (opcional)<input id="md" value="'+esc(d.d||'')+'"></label>';
    h+='<p class="hint">Escreve cada capítulo em texto simples: linhas começadas por <code>1.</code> formam passos numerados, por <code>-</code> formam listas, por <code>&gt;</code> destacam um aviso. Usa <code>**negrito**</code>, <code>*itálico*</code> e <code>`código`</code>. Linha em branco separa parágrafos.</p>';
    d.ch.forEach(function(c,i){
      h+='<div class="chap"><div class="chtools"><span>Capítulo '+(i+1)+'</span><span><button class="btn sm" data-act="up" data-i="'+i+'">↑</button> <button class="btn sm" data-act="down" data-i="'+i+'">↓</button> <button class="btn sm dng" data-act="delch" data-i="'+i+'">Remover</button></span></div><label class="f">Título do capítulo<input class="ct1" value="'+esc(c.t)+'"></label><label class="f">Conteúdo<textarea class="cb1">'+esc(c.b)+'</textarea></label></div>';
    });
    h+='<button class="btn" data-act="addch">+ Capítulo</button><p class="err" style="margin-top:12px">'+esc(m.err||'')+'</p><div class="acts"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="saveman">'+(busy?'A guardar…':'Guardar manual')+'</button></div>';
  }else if(m.t==='confirm'){
    h+='<h3>'+esc(m.msg)+'</h3><p class="hint">Esta ação não pode ser desfeita.</p><div class="acts"><button class="btn" data-act="close">Cancelar</button><button class="btn dng" data-act="doconfirm">Remover</button></div>';
  }
  return h+'</div></div>';
}

function toast(t){toastMsg=t;render();setTimeout(function(){toastMsg='';var e=$('.toast');if(e)e.remove()},3500)}

function api(method,url,body){
  return fetch(url,{method:method,headers:body?{'Content-Type':'application/json'}:{},credentials:'same-origin',body:body?JSON.stringify(body):undefined})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok){var er=new Error(j.error||('http_'+r.status));er.status=r.status;throw er}return j})});
}
async function save(){
  busy=true;render();
  try{
    var saved=await api('PUT','/api/data',{sites:state.sites,manuals:state.manuals});
    state=saved;busy=false;return true;
  }catch(e){
    busy=false;
    if(e.status===401){admin=false;if(modal)modal.err='A sessão expirou. Volta a entrar como admin.';}
    else if(modal)modal.err='Não foi possível guardar ('+(e.message||'erro')+').';
    render();return false;
  }
}
async function load(){
  try{var r=await Promise.all([api('GET','/api/data'),api('GET','/api/me')]);state=r[0];admin=!!r[1].admin}
  catch(e){toastMsg='Não foi possível carregar os dados.'}
  loaded=true;render();
}

function collectMan(){
  var d=modal.d;d.t=$('#mt').value;d.d=$('#md').value;
  var ts=document.querySelectorAll('.ct1'),bs=document.querySelectorAll('.cb1');
  d.ch=[].map.call(ts,function(t,i){return {t:t.value,b:bs[i].value}});
}

document.addEventListener('click',async function(e){
  var el=e.target.closest('[data-act]');if(!el)return;
  var a=el.getAttribute('data-act'),id=el.getAttribute('data-id'),i=+el.getAttribute('data-i');
  if(a==='login'){modal={t:'login'};render();var u=$('#lu');u&&u.focus();return}
  if(a==='logout'){try{await api('POST','/api/logout',{})}catch(x){}admin=false;modal=null;render();return}
  if(a==='close'){modal=null;busy=false;render();return}
  if(a==='go'){route=el.getAttribute('data-r')==='man'?'man':'sites';curMan=null;curCh=0;try{history.replaceState(null,'',route==='man'?'#/manuais':'#/')}catch(x){}window.scrollTo(0,0);render();return}
  if(a==='openman'){curMan=id;curCh=0;window.scrollTo(0,0);render();return}
  if(a==='closeman'){curMan=null;curCh=0;window.scrollTo(0,0);render();return}
  if(a==='ch'){curCh=i;window.scrollTo(0,0);render();return}
  if(a==='prev'){curCh=Math.max(0,curCh-1);window.scrollTo(0,0);render();return}
  if(a==='next'){curCh=curCh+1;window.scrollTo(0,0);render();return}
  if(a==='dologin'){
    try{await api('POST','/api/login',{user:$('#lu').value.trim(),pass:$('#lp').value});admin=true;modal=null;render()}
    catch(x){modal.err=x.status===429?'Demasiadas tentativas. Tenta novamente dentro de alguns minutos.':'Utilizador ou palavra-passe incorretos.';render()}
    return}
  if(!admin)return;
  if(a==='newsite'){modal={t:'site',d:{n:'',u:'',c:'',d:''}};render();return}
  if(a==='editsite'){modal={t:'site',d:JSON.parse(JSON.stringify(find(state.sites,id)))};render();return}
  if(a==='delsite'){modal={t:'confirm',msg:'Remover este site?',kind:'site',id:id};render();return}
  if(a==='savesite'){
    var d=modal.d;d.n=$('#sn').value.trim();d.c=$('#sc').value.trim();d.d=$('#sd').value.trim();d.u=normUrl($('#su').value);
    if(!d.n||!d.u||!d.c){modal.err='Preenche o nome, um endereço válido e a categoria.';render();return}
    if(d.id){state.sites=state.sites.map(function(x){return x.id===d.id?d:x})}else{d.id=uid();state.sites.push(d)}
    if(await save()){modal=null;busy=false;render()}return}
  if(a==='newman'){modal={t:'man',d:{t:'',d:'',ch:[{t:'',b:''}]}};render();return}
  if(a==='editman'){modal={t:'man',d:JSON.parse(JSON.stringify(find(state.manuals,id)))};render();return}
  if(a==='delman'){modal={t:'confirm',msg:'Remover este manual?',kind:'man',id:id};render();return}
  if(a==='addch'){collectMan();modal.d.ch.push({t:'',b:''});render();return}
  if(a==='delch'){collectMan();modal.d.ch.splice(i,1);render();return}
  if(a==='up'||a==='down'){collectMan();var j=a==='up'?i-1:i+1,ch=modal.d.ch;if(j>=0&&j<ch.length){var t=ch[i];ch[i]=ch[j];ch[j]=t}render();return}
  if(a==='saveman'){
    collectMan();var d2=modal.d;d2.t=d2.t.trim();d2.d=d2.d.trim();
    d2.ch=d2.ch.filter(function(c){return c.t.trim()||c.b.trim()});
    if(!d2.t||!d2.ch.length){modal.err='Indica o título e pelo menos um capítulo.';render();return}
    d2.ch.forEach(function(c){c.t=c.t.trim()||'Sem título'});
    if(d2.id){state.manuals=state.manuals.map(function(x){return x.id===d2.id?d2:x})}else{d2.id=uid();state.manuals.push(d2)}
    if(await save()){modal=null;busy=false;render()}return}
  if(a==='doconfirm'){
    if(modal.kind==='site')state.sites=state.sites.filter(function(x){return x.id!==modal.id});
    else{state.manuals=state.manuals.filter(function(x){return x.id!==modal.id});if(curMan===modal.id)curMan=null}
    if(await save()){modal=null;busy=false;render()}return}
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&modal){modal=null;busy=false;render();return}
  if(e.key==='Enter'&&modal&&modal.t==='login'&&e.target.tagName==='INPUT'){var b=$('[data-act="dologin"]');b&&b.click()}
});
window.addEventListener('hashchange',function(){route=location.hash==='#/manuais'?'man':'sites';curMan=null;render()});
$('#q').addEventListener('input',render);
load();
})();
