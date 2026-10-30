const header=document.querySelector('.header');
const menuButton=document.getElementById('menu-button');
const navMenu=document.getElementById('nav-menu');
const themeButton=document.getElementById('theme-button');
const scrollTopButton=document.getElementById('scroll-top');
const grid=document.getElementById('projects-grid');
const status=document.getElementById('projects-status');

function setMenu(open){navMenu.classList.toggle('open',open);document.body.classList.toggle('menu-open',open);menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');const icon=menuButton.querySelector('i');icon.classList.toggle('fa-bars',!open);icon.classList.toggle('fa-xmark',open);}
menuButton.addEventListener('click',()=>setMenu(!navMenu.classList.contains('open')));
navMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});

function handleScroll(){header.classList.toggle('scrolled',window.scrollY>30);scrollTopButton.classList.toggle('show',window.scrollY>500)}
window.addEventListener('scroll',handleScroll,{passive:true});
scrollTopButton.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

function updateTheme(){const light=document.body.classList.contains('light-theme');themeButton.querySelector('i').className=light?'fa-solid fa-sun':'fa-solid fa-moon';themeButton.setAttribute('aria-pressed',String(light));themeButton.setAttribute('aria-label',light?'Ativar tema escuro':'Ativar tema claro');}
const savedTheme=localStorage.getItem('portfolio-theme');if(savedTheme)document.body.classList.toggle('light-theme',savedTheme==='light');else if(window.matchMedia?.('(prefers-color-scheme: light)').matches)document.body.classList.add('light-theme');updateTheme();themeButton.addEventListener('click',()=>{const light=document.body.classList.toggle('light-theme');localStorage.setItem('portfolio-theme',light?'light':'dark');updateTheme()});


const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validURL = (url, image=false) => {
  if (typeof url !== 'string' || !url.trim() || /[\\\u0000-\u001f]/.test(url)) return '';
  const s=url.trim();
  if (image && /^(?:assets\/)[a-z0-9_./-]+\.(?:png|jpg|jpeg|webp|gif|svg)$/i.test(s) && !s.split('/').includes('..')) return s;
  try { const u=new URL(s,location.href); return ['https:','http:'].includes(u.protocol) && (/^https?:\/\//i.test(s)) ? u.href : ''; }catch {return '';}
};
const slugOK = s => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const cleanProject = x => {
  if (!x || typeof x !== 'object' || !slugOK(x.slug) || typeof x.title !== 'string' || !x.title.trim()) return null;
  return {...x, title:x.title.slice(0,120), points:Array.isArray(x.points)?x.points.filter(v=>typeof v==='string').slice(0,30):[], tech:Array.isArray(x.tech)?x.tech.filter(v=>typeof v==='string').slice(0,25):[], gallery:Array.isArray(x.gallery)?x.gallery.filter(v=>v&&validURL(v.image,true)).slice(0,12):[], image:validURL(x.image,true), link:validURL(x.link), published:x.published!==false};
};
const placeholder = '<div class="project-placeholder" aria-hidden="true"><i class="fa-solid fa-code"></i></div>';
let allProjects=[];
const search=document.getElementById('project-search'), filter=document.getElementById('project-filter'), featured=document.getElementById('featured-only');
const projectUrl = p => `projeto.html?slug=${encodeURIComponent(p.slug)}`;
function projectCard(p){
  const visual=p.image?`<img src="${esc(p.image)}" alt="${esc(p.image_alt||p.title)}" loading="lazy">`:placeholder;
  const details=esc(projectUrl(p));
  const access=p.link?`<a class="btn btn-primary project-action project-action-primary" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Acessar projeto <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`:`<span class="project-link-pending" title="Cadastre a URL em data/projects.json, campo link"><button class="btn btn-primary project-action project-action-primary" type="button" disabled aria-label="Acessar projeto: link ainda não cadastrado">Acessar projeto</button><small>Link ainda não cadastrado</small></span>`;
  return `<article class="project-card reveal visible"><a class="project-image" href="${details}" aria-label="Ver detalhes de ${esc(p.title)}">${visual}<span class="project-type">${esc(p.type||'Projeto')}</span></a><div class="project-content"><div class="project-header"><div><span class="project-kicker">${p.featured?'<i class="fa-solid fa-star"></i> Destaque · ':''}${esc(p.kicker||'Projeto')}</span><h2><a href="${details}">${esc(p.title)}</a></h2></div></div><p>${esc(p.description)}</p><div class="project-tech">${p.tech.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="project-card-actions"><a class="btn btn-outline project-action project-action-secondary" href="${details}">Ver detalhes <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>${access}</div></div></article>`;
}
function render(){
 const q=(search?.value||'').trim().toLocaleLowerCase('pt-BR');const type=filter?.value||'';
 const filtered=allProjects.filter(p=>(!type||(p.type||'Projeto')===type)&&(!featured?.checked||p.featured)&&(!q||[p.title,p.description,p.type,p.kicker,...p.tech].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
 grid.innerHTML=filtered.map(projectCard).join('');
 status.textContent=`${filtered.length} projeto${filtered.length===1?'':'s'} encontrado${filtered.length===1?'':'s'}.`;
 if(!filtered.length) grid.innerHTML='<div class="projects-empty">Nenhum resultado. Experimente outro termo ou filtro.</div>';
}
async function loadProjects(){
 try {
   if(location.protocol==='file:') throw new Error('Abra o projeto por um servidor HTTP local.');
   const res=await fetch('data/projects.json',{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);
   const data=await res.json();if(!Array.isArray(data.projects))throw new Error('Formato JSON inválido.');
   const seen=new Set();allProjects=data.projects.map(cleanProject).filter(p=>{if(!p||!p.published||seen.has(p.slug))return false;seen.add(p.slug);return true}).sort((a,b)=>Number(b.featured)-Number(a.featured));
   const types=[...new Set(allProjects.map(p=>p.type||'Projeto'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
   if(filter)filter.innerHTML='<option value="">Todas as categorias</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
   render();
 }catch(err){grid.innerHTML='';status.classList.add('error');status.textContent='Não foi possível carregar os projetos. Verifique data/projects.json e execute o site em um servidor HTTP.';console.error('Falha ao carregar projetos:',err)}
}
search?.addEventListener('input',render);filter?.addEventListener('change',render);featured?.addEventListener('change',render);
document.getElementById('year').textContent=new Date().getFullYear();handleScroll();loadProjects();
