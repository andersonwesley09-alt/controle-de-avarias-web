const header=document.querySelector('.header');
const menuButton=document.getElementById('menu-button');
const navMenu=document.getElementById('nav-menu');
const themeButton=document.getElementById('theme-button');
const navLinks=[...document.querySelectorAll('.nav-link')];
const scrollTopButton=document.getElementById('scroll-top');
const sections=[...document.querySelectorAll('section[id]')];
const revealElements=document.querySelectorAll('.reveal');
const contactForm=document.getElementById('contact-form');
const formMessage=document.getElementById('form-message');
const typingElement=document.getElementById('typing');

function setMenu(open){navMenu.classList.toggle('open',open);document.body.classList.toggle('menu-open',open);menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');const icon=menuButton.querySelector('i');icon.classList.toggle('fa-bars',!open);icon.classList.toggle('fa-xmark',open)}
menuButton.addEventListener('click',()=>setMenu(!navMenu.classList.contains('open')));
navLinks.forEach(link=>link.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});

let ticking=false;
function handleScroll(){if(ticking)return;ticking=true;requestAnimationFrame(()=>{header.classList.toggle('scrolled',window.scrollY>30);scrollTopButton.classList.toggle('show',window.scrollY>500);setActiveLink();ticking=false})}
function setActiveLink(){const position=window.scrollY+180;let current='home';sections.forEach(section=>{if(position>=section.offsetTop)current=section.id});navLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${current}`))}
window.addEventListener('scroll',handleScroll,{passive:true});scrollTopButton.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

function updateThemeIcon(){const light=document.body.classList.contains('light-theme');const icon=themeButton.querySelector('i');icon.className=light?'fa-solid fa-sun':'fa-solid fa-moon';themeButton.setAttribute('aria-pressed',String(light));themeButton.setAttribute('aria-label',light?'Ativar tema escuro':'Ativar tema claro')}
const savedTheme=localStorage.getItem('portfolio-theme');if(savedTheme)document.body.classList.toggle('light-theme',savedTheme==='light');else if(window.matchMedia?.('(prefers-color-scheme: light)').matches)document.body.classList.add('light-theme');updateThemeIcon();themeButton.addEventListener('click',()=>{const light=document.body.classList.toggle('light-theme');localStorage.setItem('portfolio-theme',light?'light':'dark');updateThemeIcon()});

const words=['sistemas.','automações.','aplicações web.','soluções digitais.','APIs.','integrações.'];let wordIndex=0,charIndex=0,deleting=false,typingTimer;
function typeText(){const word=words[wordIndex];typingElement.textContent=deleting?word.slice(0,charIndex-1):word.slice(0,charIndex+1);charIndex+=deleting?-1:1;if(!deleting&&charIndex===word.length){deleting=true;typingTimer=setTimeout(typeText,1600);return}if(deleting&&charIndex===0){deleting=false;wordIndex=(wordIndex+1)%words.length}typingTimer=setTimeout(typeText,deleting?45:80)}
if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){typingElement.textContent=words[0]}else typeText();

const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.1});revealElements.forEach(el=>observer.observe(el));

contactForm.addEventListener('submit',event=>{event.preventDefault();const name=document.getElementById('name').value.trim();const email=document.getElementById('email').value.trim();const subject=document.getElementById('subject').value.trim();const message=document.getElementById('message').value.trim();if(!name||!email||!subject||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){formMessage.className='form-message error';formMessage.textContent='Preencha nome, e-mail válido, assunto e mensagem.';return}formMessage.className='form-message sending';formMessage.textContent='Preparando seu aplicativo de e-mail...';const body=`Olá, Wesley!\n\nNome: ${name}\nE-mail: ${email}\n\n${message}`;const mailto=`mailto:andersonwesley09@email.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;window.setTimeout(()=>{window.location.href=mailto;formMessage.className='form-message success';formMessage.textContent='Rascunho preparado. Confirme o envio no aplicativo de e-mail; o site não envia mensagens automaticamente.'},180)});

document.getElementById('year').textContent=new Date().getFullYear();handleScroll();
