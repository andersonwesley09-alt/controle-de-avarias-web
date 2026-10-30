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



const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=(value,image=false)=>{if(typeof value!=='string'||/[\\\u0000-\u001f]/.test(value))return ''; const v=value.trim();if(image&&/^assets\/[a-z0-9_./-]+\.(png|jpg|jpeg|webp|gif|svg)$/i.test(v)&&!v.split('/').includes('..'))return v;try{const u=new URL(v,location.href);return /^https?:\/\//i.test(v)&&['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
const target=document.getElementById('project-detail');
function galleryImg(o){const src=safeUrl(o?.image,true);return src?`<a href="${esc(src)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir imagem em tamanho maior"><img src="${esc(src)}" alt="${esc(o.alt||'Imagem do projeto')}" loading="lazy"></a>`:''}
async function start(){try{
 const slug=new URLSearchParams(location.search).get('slug');if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error('Projeto não encontrado.');
 if(location.protocol==='file:')throw new Error('Abra usando um servidor HTTP local.');
 const response=await fetch('data/projects.json',{cache:'no-store'});if(!response.ok)throw new Error('Falha ao carregar dados.');const json=await response.json();if(!Array.isArray(json.projects))throw new Error('Dados inválidos.');
 const p=json.projects.find(x=>x&&x.slug===slug&&x.published!==false);if(!p)throw new Error('Projeto não encontrado.');
 const tech=Array.isArray(p.tech)?p.tech:[],points=Array.isArray(p.points)?p.points:[],gallery=Array.isArray(p.gallery)?p.gallery:[];
 const cover=safeUrl(p.image,true);if(cover&&!gallery.some(g=>g.image===p.image))gallery.unshift({image:cover,alt:p.image_alt||p.title});
 const link=safeUrl(p.link);document.title=`${p.title} | Wesley`;
 document.querySelector('meta[name="description"]')?.setAttribute('content',String(p.description||'Projeto do portfólio de Wesley').slice(0,160));
 document.querySelector('meta[property="og:title"]')?.setAttribute('content',`${p.title} | Wesley`);
 document.querySelector('meta[property="og:description"]')?.setAttribute('content',String(p.description||'').slice(0,200));
 target.innerHTML=`<div class="detail-hero"><span class="section-tag">${p.featured?'★ Destaque · ':''}${esc(p.type||'Projeto')}</span><h1>${esc(p.title)}</h1><p>${esc(p.description)}</p><div class="detail-actions">${link?`<a class="btn btn-primary project-action project-action-primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Acessar projeto <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:`<span class="project-link-pending"><button type="button" class="btn btn-primary project-action project-action-primary" disabled>Acessar projeto</button><small>Link ainda não cadastrado</small></span>`}<a class="btn btn-outline project-action project-action-secondary" href="projetos.html">Voltar aos projetos</a></div></div><div class="detail-layout"><section><h2>Sobre o projeto</h2><p>${esc(p.details||p.description)}</p><h2>Funcionalidades</h2><ul class="detail-points">${points.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section><aside><h2>Tecnologias</h2><div class="project-tech">${tech.map(t=>`<span>${esc(t)}</span>`).join('')}</div></aside></div>${gallery.length?`<section class="detail-gallery"><h2>Galeria de imagens</h2><div class="gallery-grid">${gallery.map(galleryImg).join('')}</div></section>`:''}`;
 }catch(err){target.innerHTML=`<div class="projects-empty"><h1>Projeto indisponível</h1><p>${esc(err.message)}</p><a href="projetos.html">Voltar aos projetos</a></div>`}}
document.getElementById('year').textContent=new Date().getFullYear();handleScroll();start();
