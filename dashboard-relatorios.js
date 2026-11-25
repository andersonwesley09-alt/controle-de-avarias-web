'use strict';
/* V26.1 OPERACIONAL - ajuste visual dos relatórios do Dashboard (somente leitura).
 * Layout do sistema NÃO é alterado. Sem alterações no banco.
 * Unidades: não deduzimos UND/KG pela descrição (ex.: ARROZ 1KG é UND).
 */
const XLSX=require('xlsx'),CFB=require('cfb');
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const str=(v,d='-')=>String(v===null||v===undefined||v===''?d:v).trim();
const centavos=v=>Math.round((num(v)+Math.abs(num(v))*Number.EPSILON)*100)/100;
const real=v=>centavos(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const inteiro=v=>num(v).toLocaleString('pt-BR',{maximumFractionDigits:0});
const qtd=(v,unidade='')=>{const n=num(v);return unidade==='KG'||!Number.isInteger(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):inteiro(n);};
const medida=v=>{const s=str(v,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'');if(['UND','UN','UNID','UNIDADE','UNIDADES','PC','PCA','PECA','PECAS','CX','CAIXA','PCT','PACOTE'].includes(s))return 'UND';if(['KG','KGS','QUILO','QUILOS','QUILOGRAMA','QUILOGRAMAS'].includes(s))return 'KG';return 'N/I';};
const dataBR=(v,hora=false)=>{const d=new Date(v);return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',day:'2-digit',month:'2-digit',year:'numeric',...(hora?{hour:'2-digit',minute:'2-digit'}:{})}).format(d)};
const dataISO=v=>{const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const x=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(a=>[a.type,a.value]));return `${x.year}-${x.month}-${x.day}`;};
const curto=(v,k=50)=>{const s=str(v,'');return s.length>k?s.slice(0,Math.max(1,k-1)).trimEnd()+'…':s;};
const dataFiltroBR=v=>{const s=String(v??'');const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s;};
const textoFiltro=(d)=>Object.entries(d.filtros||{}).filter(([k,v])=>v&&v!=='Todos'&&v!=='Todas'&&v!=='Não informada').map(([k,v])=>`${k}: ${dataFiltroBR(v)}`).join('  |  ')||'Sem filtros adicionais';
const totalGrupo=(rs)=>({registros:rs.length,valor:rs.reduce((a,r)=>a+r.valor,0),qtd:rs.reduce((a,r)=>a+r.quantidade,0),und:rs.filter(r=>r.unidade==='UND').reduce((a,r)=>a+r.quantidade,0),kg:rs.filter(r=>r.unidade==='KG').reduce((a,r)=>a+r.quantidade,0),ni:rs.filter(r=>r.unidade==='N/I').reduce((a,r)=>a+r.quantidade,0)});
function topComOutros(list,limite=5){if(list.length<=limite)return list;const resto=list.slice(limite);return [...list.slice(0,limite),{nome:'Outros',valor:resto.reduce((a,b)=>a+b.valor,0),registros:resto.reduce((a,b)=>a+b.registros,0),quantidade:resto.reduce((a,b)=>a+b.quantidade,0)}];}
function agrupar(rs,fn){const m=new Map();for(const r of rs){const nome=str(fn(r),'Não informado');if(!m.has(nome))m.set(nome,{nome,registros:0,quantidade:0,valor:0,und:0,kg:0,ni:0});const a=m.get(nome);a.registros++;a.quantidade+=r.quantidade;a.valor+=r.valor;a[r.unidade==='UND'?'und':r.unidade==='KG'?'kg':'ni']+=r.quantidade;}return [...m.values()].sort((a,b)=>b.valor-a.valor);}
function preparar(rows,opts={}){
 const visao=opts.visao==='caixas'?'caixas':'avarias';
 const registros=rows.map(r=>({id:str(r.id,''),data:r.movimentadoEm||r.criadoEm||'',codigo:str(r.codigo,''),produto:str(r.produto),fornecedor:str(r.fornecedor,'Não informado'),categoria:str(r.categoria,'Mercearia'),setor:str(r.setor,visao==='caixas'?'Caixas':'Não informado'),motivo:str(r.tipo,visao==='caixas'?'Estoque':'Não informado'),caixa:str(r.caixa,''),status:str(r.status,''),usuario:str(r.usuarioLancamento,''),unidade:medida(r.unidadeMedida||r.unidade_medida||r.unidade||r.um),quantidade:num(r.quantidade),valorUnitario:num(r.valorUnitario),valor:num(r.quantidade)*num(r.valorUnitario)}));
 const produtos=agrupar(registros,r=>`${r.codigo||r.produto}|${r.produto}`).map(x=>({...x,nome:x.nome.split('|').slice(1).join('|')||x.nome}));
 const mapa=new Map();for(const r of registros){const dia=dataISO(r.data);if(!dia)continue;if(!mapa.has(dia))mapa.set(dia,{nome:dia,valor:0,quantidade:0,registros:0});const a=mapa.get(dia);a.valor+=r.valor;a.quantidade+=r.quantidade;a.registros++;}
 const medidas=totalGrupo(registros);
 return {visao,tipo:opts.tipo==='detalhado'?'detalhado':'gerencial',nome:visao==='caixas'?'Estoque nas Caixas':'Avarias',registros,produtos,fornecedores:agrupar(registros,r=>r.fornecedor),setores:agrupar(registros,r=>visao==='caixas'?r.caixa:r.setor),categorias:agrupar(registros,r=>r.categoria),motivos:agrupar(registros,r=>visao==='caixas'?r.categoria:r.motivo),evolucao:[...mapa.values()].sort((a,b)=>a.nome.localeCompare(b.nome)),total:medidas.valor,quantidade:medidas.qtd,medidas,distintos:new Set(registros.map(r=>r.codigo||r.produto)).size,filtros:opts.filtros||{},emitido:dataBR(new Date(),true)};
}
const NAVY=[.060,.154,.300],BLUE=[.080,.300,.630],RED=[.755,.145,.210],INK=[.116,.165,.244],MUTED=[.37,.43,.51],WHITE=[1,1,1],SOFT=[.957,.968,.983],EDGE=[.83,.87,.92],GREEN=[.085,.47,.37],ORANGE=[.95,.62,.18];
const PALETTE=[[.080,.300,.630],[.25,.49,.76],[.56,.70,.83],[.80,.86,.91],[.91,.48,.32],[.96,.71,.34],[.22,.50,.41],[.65,.63,.77]];
const rgb=a=>a.map(x=>x.toFixed(3)).join(' ');
const escapePdf=s=>String(s??'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[…]/g,'...').replace(/[^\x20-\xff]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]/g,' ');
class PDF{
 constructor(){this.W=595.28;this.H=841.89;this.pages=[];this.ops=[];}
 rect(x,y,w,h,c=SOFT){this.ops.push(`${rgb(c)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);}
 line(x1,y1,x2,y2,c=EDGE,sw=.7){this.ops.push(`${rgb(c)} RG ${sw.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);}
 txt(x,y,s,size=8,bold=false,c=INK){this.ops.push(`${rgb(c)} rg BT /F${bold?2:1} ${size.toFixed(1)} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${escapePdf(s)}) Tj ET`);}
 right(xRight,y,s,size=8,bold=false,c=INK){this.txt(xRight-String(s).length*size*(bold?.525:.49),y,s,size,bold,c);}
 center(x,y,s,size=8,bold=false,c=INK){this.txt(x-String(s).length*size*(bold?.525:.49)/2,y,s,size,bold,c);}
 circle(x,y,r,c){const k=r*.55228475;this.ops.push(`${rgb(c)} rg ${(x+r).toFixed(2)} ${y.toFixed(2)} m ${(x+r).toFixed(2)} ${(y+k).toFixed(2)} ${(x+k).toFixed(2)} ${(y+r).toFixed(2)} ${x.toFixed(2)} ${(y+r).toFixed(2)} c ${(x-k).toFixed(2)} ${(y+r).toFixed(2)} ${(x-r).toFixed(2)} ${(y+k).toFixed(2)} ${(x-r).toFixed(2)} ${y.toFixed(2)} c ${(x-r).toFixed(2)} ${(y-k).toFixed(2)} ${(x-k).toFixed(2)} ${(y-r).toFixed(2)} ${x.toFixed(2)} ${(y-r).toFixed(2)} c ${(x+k).toFixed(2)} ${(y-r).toFixed(2)} ${(x+r).toFixed(2)} ${(y-k).toFixed(2)} ${(x+r).toFixed(2)} ${y.toFixed(2)} c f`);}
 segment(x,y,r,ang1,ang2,c){const points=Math.max(3,Math.ceil((ang2-ang1)/6));let s=`${rgb(c)} rg ${x.toFixed(2)} ${y.toFixed(2)} m `;for(let i=0;i<=points;i++){const t=(ang1+(ang2-ang1)*i/points)*Math.PI/180;s+=`${(x+r*Math.cos(t)).toFixed(2)} ${(y+r*Math.sin(t)).toFixed(2)} l `;}this.ops.push(s+'h f');}
 page(){if(this.ops.length)this.pages.push(this.ops);this.ops=[];}
 masthead(title,periodo,emitido){this.rect(0,797,this.W,45,NAVY);this.txt(27,817,'EmpresaExemplo',13.3,true,WHITE);this.txt(27,806,'CONTROLE DE AVARIAS  /  INTELIGÊNCIA GERENCIAL',7.0,false,[.79,.86,.94]);this.right(568,814,'RELATÓRIO GERENCIAL',9,true,WHITE);
  this.txt(27,771,title,18,true,NAVY);this.line(27,761,568,761,EDGE);
  this.txt(27,743,'PERÍODO ANALISADO',7,true,MUTED);this.txt(27,730,periodo,8.5,true,INK);
  this.txt(229,743,'FILTROS APLICADOS',7,true,MUTED);this.txt(229,730,'Conforme seleção do Dashboard',7.5,false,INK);
  this.txt(455,743,'EMITIDO EM',7,true,MUTED);this.right(565,730,emitido,7.8,true,INK);
 }
 detailHead(title,subtitle){this.rect(0,794,this.W,48,NAVY);this.txt(27,816,'EmpresaExemplo  /  CONTROLE DE AVARIAS',10.5,true,WHITE);this.txt(27,804,subtitle,8,false,[.79,.86,.94]);this.txt(27,762,title,16,true,NAVY);this.line(27,751,568,751,EDGE);}
 finish(){this.page();this.pages.forEach((ops,i)=>{ops.push(`${rgb(EDGE)} RG 0.5 w 27 34 m 568 34 l S`);ops.push(`${rgb(MUTED)} rg BT /F1 7 Tf 1 0 0 1 27 21 Tm (Controle de Avarias  |  V26.2  |  Criador: Wesley) Tj ET`);ops.push(`${rgb(MUTED)} rg BT /F1 7 Tf 1 0 0 1 516 21 Tm (Pag. ${i+1} / ${this.pages.length}) Tj ET`);});
 const objects=[];const push=s=>(objects.push(s),objects.length);const root=push('<< /Type /Catalog /Pages 2 0 R >>');const pages=push('');const f1=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const f2=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');const ids=[];
 for(const page of this.pages){const content=page.join('\n')+'\n';const stm=push(`<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}endstream`);ids.push(push(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${stm} 0 R >>`));}objects[pages-1]=`<< /Type /Pages /Kids [${ids.map(id=>id+' 0 R').join(' ')}] /Count ${ids.length} >>`;
 let body='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets[i+1]=Buffer.byteLength(body,'latin1');body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const pos=Buffer.byteLength(body,'latin1');body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)body+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;body+=`trailer\n<< /Size ${objects.length+1} /Root ${root} 0 R >>\nstartxref\n${pos}\n%%EOF`;return Buffer.from(body,'latin1');
 }
}
function tituloSec(p,x,y,t){p.rect(x,y-3,3,16,RED);p.txt(x+11,y+1,t,10.6,true,NAVY);}
function painel(p,x,y,w,h){p.rect(x,y,w,h,WHITE);p.line(x,y+h,x+w,y+h,EDGE);p.line(x,y,x,y+h,EDGE);p.line(x+w,y,x+w,y+h,EDGE);p.line(x,y,x+w,y,EDGE);}
function cartao(p,x,y,w,label,valor,cor=BLUE){p.rect(x,y,w,61,SOFT);p.rect(x,y,3,61,cor);p.txt(x+11,y+43,curto(label,22),7.1,false,MUTED);p.txt(x+11,y+16,curto(valor,w<120?19:28),w<115?11:12.4,true,cor===RED?RED:NAVY);}
function evolucao(p,d,x,y,w,h){painel(p,x,y,w,h);tituloSec(p,x+12,y+h-26,d.visao==='caixas'?'Evolução dos lançamentos':'Evolução do valor das perdas');const a=d.evolucao.slice(-12);if(!a.length){p.txt(x+14,y+65,'Sem movimentos datados no período.',9,false,MUTED);return;}
 const L=x+38,R=x+w-14,B=y+38,T=y+h-53,max=Math.max(1,...a.map(v=>v.valor));for(let i=0;i<=3;i++){const yy=B+(T-B)*i/3;p.line(L,yy,R,yy,[.89,.91,.95],.5);p.right(L-5,yy-2,`R$ ${Math.round(max*i/3).toLocaleString('pt-BR')}`,6.3,false,MUTED);}
 const step=(R-L)/a.length,bw=Math.min(26,step*.66);for(let i=0;i<a.length;i++){const v=a[i],bh=Math.max(2,(T-B)*v.valor/max),bx=L+step*i+(step-bw)/2;p.rect(bx,B,bw,bh,i===a.length-1?NAVY:BLUE);if(a.length<=9)p.center(bx+bw/2,B+bh+5,real(v.valor).replace('R$ ',''),6.0,true,NAVY);p.center(L+step*(i+.5),B-16,v.nome.slice(8,10)+'/'+v.nome.slice(5,7),6.5,false,MUTED);}
}
function anel(p,dados,x,y,w,h,titulo,total){painel(p,x,y,w,h);tituloSec(p,x+12,y+h-25,titulo);const arr=topComOutros(dados,5),v=arr.reduce((s,a)=>s+a.valor,0),cx=x+77,cy=y+68,r=42;let a=90;arr.forEach((k,i)=>{const fraction=total?Math.max(0,k.valor/total):0;const size=360*fraction;if(size>0){p.segment(cx,cy,r,a,a+size,PALETTE[i]);a+=size;}});if(a<450)p.segment(cx,cy,r,a,450,PALETTE[7]);p.circle(cx,cy,r*.59,WHITE);p.center(cx,cy+3,real(total).replace('R$ ',''),8.5,true,NAVY);p.center(cx,cy-10,'TOTAL (R$)',5.9,false,MUTED);
 arr.forEach((r,i)=>{const yy=y+h-48-i*18;p.rect(x+135,yy-2,7,7,PALETTE[i]);p.txt(x+147,yy,curto(r.nome,18),6.7,false,INK);p.right(x+w-10,yy,total?((r.valor/total)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'0%',6.7,true,NAVY);});}
function tab(p,title,items,x,y,w,cols,heads,limit=6){tituloSec(p,x,y,title);const top=y-10;let left=x; p.rect(x,top-23,w,22,NAVY);heads.forEach((h,i)=>{const width=cols[i];p.txt(left+5,top-16,h,6.7,true,WHITE);left+=width;});let yy=top-38;items.slice(0,limit).forEach((row,i)=>{if(i%2===0)p.rect(x,yy-6,w,18,SOFT);let off=x;row.forEach((v,j)=>{const width=cols[j],size=7.1,chars=Math.max(6,Math.floor((width-11)/(size*.51)));if(j===row.length-1)p.right(off+width-6,yy,curto(String(v),chars),size,false,INK);else p.txt(off+5,yy,curto(String(v),chars),size,false,INK);off+=width;});yy-=20;});return yy;}
function resumoMedidas(d){const a=d.medidas;return [a.und?`${qtd(a.und)} UND`:null,a.kg?`${qtd(a.kg)} KG`:null,a.ni?`${qtd(a.ni)} sem U.M.`:null].filter(Boolean).join('  |  ')||'0';}
function totais(p,d,y){p.rect(27,y,541,65,SOFT);p.rect(27,y,5,65,NAVY);p.txt(40,y+46,'TOTAIS DO RELATÓRIO',9.2,true,NAVY);p.txt(40,y+26,`Registros: ${inteiro(d.registros.length)}     Produtos: ${inteiro(d.distintos)}`,8,true,INK);p.txt(40,y+11,`Quantidade: ${curto(resumoMedidas(d),47)}`,7.6,false,INK);p.right(556,y+22,real(d.total),15,true,RED);p.txt(29,y-14,'* UND/KG são separados somente quando a unidade consta no cadastro; demais itens: sem U.M.',6.5,false,MUTED);}
function gerarPdf(d){const p=new PDF(),nome=d.visao==='caixas'?'Relatório Gerencial de Estoque nas Caixas':'Relatório Gerencial de Avarias',inicio=str(d.filtros['Data inicial']||'', ''),fim=str(d.filtros['Data final']||'','');const periodo=d.visao==='caixas'?'Posição atual do estoque':`${/^\d{4}-\d{2}-\d{2}$/.test(inicio)?inicio.split('-').reverse().join('/'):inicio||'Todas'} a ${/^\d{4}-\d{2}-\d{2}$/.test(fim)?fim.split('-').reverse().join('/'):fim||'Todas'}`;
 p.masthead(nome,periodo,d.emitido);tituloSec(p,27,703,'RESUMO EXECUTIVO');const cards=[['Lançamentos',inteiro(d.registros.length),BLUE],['Quantidade*',qtd(d.quantidade),BLUE],[d.visao==='caixas'?'Valor armazenado':'Valor perdido',real(d.total),RED],['Fornecedores',inteiro(d.fornecedores.length),BLUE],['Produtos',inteiro(d.distintos),BLUE]];cards.forEach((c,i)=>cartao(p,27+i*109.5,626,105,c[0],c[1],c[2]));
 evolucao(p,d,27,407,541,205);anel(p,d.categorias,27,207,265,185,d.visao==='caixas'?'Estoque por categoria':'Perdas por categoria',d.total);anel(p,d.setores,304,207,264,185,d.visao==='caixas'?'Estoque por caixa':'Perdas por setor',d.total);
 p.rect(27,164,541,30,SOFT);p.txt(39,181,'LEITURA GERENCIAL',7.1,true,NAVY);const top=d.setores[0];p.txt(39,170,top?`Maior concentração: ${curto(top.nome,36)} (${real(top.valor)}).`:'Sem dados de concentração no período.',8,false,INK);p.txt(28,141,`Filtros: ${curto(textoFiltro(d),110)}`,7,false,MUTED);p.txt(28,125,'As quantidades não devem ser somadas entre UND e KG sem identificação da unidade.',7,false,MUTED);
 p.page();p.detailHead(nome,'Análises consolidadas, rankings e fechamento');const sectors=d.setores.slice(0,6).map((r,i)=>[String(i+1),r.nome,inteiro(r.registros),real(r.valor)]);const cats=d.categorias.slice(0,6).map((r,i)=>[String(i+1),r.nome,inteiro(r.registros),real(r.valor)]);tab(p,'PERDAS POR SETOR',sectors,27,724,261,[22,115,44,80],['#','Setor','Reg.','Valor (R$)'],6);tab(p,'PERDAS POR CATEGORIA',cats,307,724,261,[22,115,44,80],['#','Categoria','Reg.','Valor (R$)'],6);
 const produtos=d.produtos.slice(0,7).map((r,i)=>[String(i+1),r.nome,inteiro(r.registros),real(r.valor)]);tab(p,'TOP 7 PRODUTOS - MAIOR IMPACTO',produtos,27,513,541,[25,325,70,121],['#','Produto','Registros','Valor (R$)'],7);
 const fornecedores=d.fornecedores.slice(0,6).map((r,i)=>[String(i+1),r.nome,inteiro(r.registros),real(r.valor)]);tab(p,'TOP 6 FORNECEDORES - MAIOR IMPACTO',fornecedores,27,291,541,[25,325,70,121],['#','Fornecedor','Registros','Valor (R$)'],6);
 totais(p,d,68);
 if(d.tipo==='detalhado'){
  const limite=27;for(let i=0;i<d.registros.length;i+=limite){p.page();p.detailHead('Relação detalhada dos lançamentos',`Registros ${i+1}-${Math.min(i+limite,d.registros.length)} / ${d.registros.length}`);const rs=d.registros.slice(i,i+limite).map(r=>[dataBR(r.data),r.codigo,r.produto,r.unidade,qtd(r.quantidade,r.unidade),real(r.valor)]);tab(p,'LANÇAMENTOS',rs,21,719,553,[66,82,222,39,67,77],['Data','Código','Produto','U.M.','Qtd.','Valor (R$)'],limite);if(i+limite>=d.registros.length)totais(p,d,65);}
 }
 return p.finish();}

function criarPlanilha(d){
 const wb=XLSX.utils.book_new(), metas=[];
 function sheet(nome,linhas,larguras,header=0,total=0){const ws=XLSX.utils.aoa_to_sheet(linhas);ws['!cols']=larguras.map(wch=>({wch}));ws['!rows']=linhas.map((_,i)=>({hpt:i===0?30:i===header-1?24:21}));if(header)ws['!autofilter']={ref:`A${header}:${XLSX.utils.encode_col(larguras.length-1)}${Math.max(header,linhas.length-(total?1:0))}`};ws['!freeze']={xSplit:0,ySplit:header||5};XLSX.utils.book_append_sheet(wb,ws,nome);metas.push({nome,header,total});return ws;}
 // Aba Resumo executiva: a interface da planilha é independente da interface do sistema.
 const R=Array.from({length:61},()=>Array(12).fill(null));
 const put=(r,c,s)=>R[r-1][c-1]=s;
 put(1,1,`EmpresaExemplo  |  CONTROLE DE AVARIAS`);put(3,1,`RELATÓRIO GERENCIAL DE ${d.nome.toUpperCase()}`);
 put(5,1,'PERÍODO');put(5,3,`${dataFiltroBR(str(d.filtros['Data inicial']||'Todos'))} a ${dataFiltroBR(str(d.filtros['Data final']||'Todos'))}`);put(5,7,'EMITIDO');put(5,9,d.emitido);
 put(6,1,'FILTROS');put(6,3,curto(textoFiltro(d),110));
 const cards=[['LANÇAMENTOS',d.registros.length],['QUANTIDADE*',d.quantidade],['VALOR PERDIDO',centavos(d.total)],['FORNECEDORES',d.fornecedores.length],['PRODUTOS',d.distintos]];
 const cardCols=[1,3,5,7,9];cards.forEach(([nome,v],i)=>{put(9,cardCols[i],nome);put(11,cardCols[i],v);});
 put(14,1,'EVOLUÇÃO DO VALOR DAS PERDAS');put(14,8,'PERDAS POR SETOR');
 put(32,1,'PRINCIPAIS SETORES');put(32,7,'PRINCIPAIS CATEGORIAS');
 ['SETOR','REGISTROS','QUANTIDADE','VALOR (R$)'].forEach((h,i)=>put(34,1+i,h));
 ['CATEGORIA','REGISTROS','QUANTIDADE','VALOR (R$)'].forEach((h,i)=>put(34,7+i,h));
 for(let i=0;i<7;i++){const s=d.setores[i],c=d.categorias[i];if(s){put(35+i,1,s.nome);put(35+i,2,s.registros);put(35+i,3,s.quantidade);put(35+i,4,centavos(s.valor));}if(c){put(35+i,7,c.nome);put(35+i,8,c.registros);put(35+i,9,c.quantidade);put(35+i,10,centavos(c.valor));}}
 put(43,1,'TOTAIS DO RELATÓRIO');put(44,1,'Registros');put(44,3,d.registros.length);put(44,5,'Valor total');put(44,7,centavos(d.total));
 put(45,1,'UND identificadas');put(45,3,d.medidas.und);put(45,5,'KG identificados');put(45,7,d.medidas.kg);put(45,9,'Sem U.M.');put(45,11,d.medidas.ni);
 put(47,1,'* Quantidade sem U.M.: unidade de medida não informada no cadastro. Não misturar UND com KG.');
 const setorGrafico=topComOutros(d.setores,5);setorGrafico.forEach((r,i)=>{put(52+i,11,r.nome);put(52+i,12,r.valor);});
 const resumo=sheet('Resumo',R,[17,15,17,21,16,13,17,16,17,21,14,12]);for(let linha=50;linha<=61;linha++)resumo['!rows'][linha-1]={hidden:true};
 resumo['!merges']=[{s:{r:0,c:0},e:{r:1,c:11}},{s:{r:2,c:0},e:{r:2,c:11}},{s:{r:13,c:0},e:{r:13,c:5}},{s:{r:13,c:7},e:{r:13,c:11}},{s:{r:31,c:0},e:{r:31,c:4}},{s:{r:31,c:6},e:{r:31,c:11}},{s:{r:42,c:0},e:{r:42,c:11}},{s:{r:46,c:0},e:{r:46,c:11}},{s:{r:10,c:4},e:{r:10,c:5}}];
 for(const c of cardCols){resumo[XLSX.utils.encode_cell({r:10,c:c-1})].z=c===5?'"R$ "#,##0.00':'#,##0.###';}
 for(let i=35;i<=41;i++){['D','J'].forEach(col=>{if(resumo[`${col}${i}`])resumo[`${col}${i}`].z='"R$ "#,##0.00';});}
 if(resumo['G44'])resumo['G44'].z='"R$ "#,##0.00';
 const H=['Data','Código','Produto','Fornecedor','Categoria','Setor','Motivo','U.M.','Quantidade','Custo unitário','Valor total','Status','Usuário'];
 const lines=[['RELAÇÃO DETALHADA DE LANÇAMENTOS'],[`Emitido em: ${d.emitido}`],[`Filtros: ${textoFiltro(d)}`],['* UND/KG somente quando identificadas no cadastro; demais: N/I.'],H];
 for(const r of d.registros)lines.push([dataBR(r.data,true),r.codigo,r.produto,r.fornecedor,r.categoria,r.setor,r.motivo,r.unidade,r.quantidade,r.valorUnitario,r.valor,r.status,r.usuario]);
 const last=5+d.registros.length,totalRow=last+1;lines.push(['TOTAL','','','','','','','',d.quantidade,'',centavos(d.total)]);
 const lanc=sheet('Lançamentos',lines,[22,20,45,33,21,19,24,10,16,18,20,17,18],5,totalRow);
 for(let i=6;i<=totalRow;i++){
  const t=lanc[`I${i}`];if(t?.t==='n')t.z=(i<=last && d.registros[i-6]?.unidade==='KG')||!Number.isInteger(t.v)?'#,##0.000':'#,##0';
  for(const col of ['J','K'])if(lanc[`${col}${i}`]?.t==='n')lanc[`${col}${i}`].z='"R$ "#,##0.00';
 }
 if(d.registros.length){lanc[`I${totalRow}`]={t:'n',v:d.quantidade,f:`SUM(I6:I${last})`,z:Number.isInteger(d.quantidade)?'#,##0':'#,##0.000'};lanc[`K${totalRow}`]={t:'n',v:centavos(d.total),f:`ROUND(SUM(K6:K${last}),2)`,z:'"R$ "#,##0.00'};}
 function ranking(nome,title,arr,label){const rows=[[title],[`Emitido em ${d.emitido}`],[`Filtros: ${textoFiltro(d)}`],[],['#',label,'Registros','Qtd. UND','Qtd. KG','Qtd. sem U.M.','Valor (R$)']];arr.forEach((v,i)=>rows.push([i+1,v.nome,v.registros,v.und,v.kg,v.ni,v.valor]));rows.push(['TOTAL','',d.registros.length,d.medidas.und,d.medidas.kg,d.medidas.ni,centavos(d.total)]);const sh=sheet(nome,rows,[9,44,14,18,18,20,23],5,rows.length);for(let i=6;i<=rows.length;i++){for(const col of ['D','E','F'])if(sh[`${col}${i}`]?.t==='n')sh[`${col}${i}`].z=col==='E'?'#,##0.000':Number.isInteger(sh[`${col}${i}`].v)?'#,##0':'#,##0.000';if(sh[`G${i}`])sh[`G${i}`].z='"R$ "#,##0.00';}return sh;}
 ranking('Por Setor','CONSOLIDADO POR SETOR',d.setores,'Setor');ranking('Por Categoria','CONSOLIDADO POR CATEGORIA',d.categorias,'Categoria');ranking('Por Motivo','CONSOLIDADO POR MOTIVO',d.motivos,'Motivo');ranking('Ranking Produtos','PRODUTOS COM MAIOR IMPACTO',d.produtos,'Produto');ranking('Ranking Fornecedores','FORNECEDORES COM MAIOR IMPACTO',d.fornecedores,'Fornecedor');
 const ev=[['EVOLUÇÃO DIÁRIA DO VALOR DAS PERDAS'],[`Emitido em: ${d.emitido}`],[],[],['Data','Registros','Quantidade','Valor (R$)']];for(const e of d.evolucao)ev.push([e.nome.slice(8,10)+'/'+e.nome.slice(5,7),e.registros,e.quantidade,e.valor]);const evol=sheet('Evolução',ev,[20,18,20,24],5);for(let i=6;i<=ev.length;i++){if(evol[`C${i}`])evol[`C${i}`].z=Number.isInteger(evol[`C${i}`].v)?'#,##0':'#,##0.000';if(evol[`D${i}`])evol[`D${i}`].z='"R$ "#,##0.00';}
 let buf=XLSX.write(wb,{bookType:'xlsx',type:'buffer'});
 try{buf=estilizarXlsx(buf,wb.SheetNames,metas,d);}catch(e){console.warn('Estilo do relatório simplificado:',e.message);}
 return buf;
}
function estilizarXlsx(bytes,names,metas,d){
 const zip=CFB.read(bytes,{type:'buffer'}),path=s=>zip.FullPaths.findIndex(p=>p.endsWith('/'+s));const stylesId=path('xl/styles.xml');if(stylesId<0)throw Error('styles.xml não encontrado');let xml=zip.FileIndex[stylesId].content.toString('utf8');
 function append(tag,child){const re=new RegExp(`<${tag} count="(\\d+)">`),m=xml.match(re);if(!m)throw Error('Estilo XLSX '+tag);const id=+m[1];xml=xml.replace(re,`<${tag} count="${id+1}">`);xml=xml.replace(`</${tag}>`,child+`</${tag}>`);return id;}
 const fw=append('fonts','<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>');
 const fn=append('fonts','<font><b/><sz val="12"/><color rgb="FF112A51"/><name val="Aptos"/></font>');
 const fv=append('fonts','<font><b/><sz val="17"/><color rgb="FF112A51"/><name val="Aptos"/></font>');
 const fr=append('fonts','<font><b/><sz val="17"/><color rgb="FFC02C36"/><name val="Aptos"/></font>');
 const fm=append('fonts','<font><sz val="10"/><color rgb="FF52647B"/><name val="Aptos"/></font>');
 const fb=append('fonts','<font><b/><sz val="11"/><color rgb="FF112A51"/><name val="Aptos"/></font>');
 const fillNav=append('fills','<fill><patternFill patternType="solid"><fgColor rgb="FF112A51"/><bgColor indexed="64"/></patternFill></fill>');
 const fillBlue=append('fills','<fill><patternFill patternType="solid"><fgColor rgb="FF21509C"/><bgColor indexed="64"/></patternFill></fill>');
 const fillPale=append('fills','<fill><patternFill patternType="solid"><fgColor rgb="FFEAF0F7"/><bgColor indexed="64"/></patternFill></fill>');
 const fillWhite=append('fills','<fill><patternFill patternType="solid"><fgColor rgb="FFF9FBFE"/><bgColor indexed="64"/></patternFill></fill>');
 const fillRed=append('fills','<fill><patternFill patternType="solid"><fgColor rgb="FFFFECED"/><bgColor indexed="64"/></patternFill></fill>');
 function xf(f,fill,number=0){return append('cellXfs',`<xf numFmtId="${number}" fontId="${f}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>`);}
 const s={title:xf(fw,fillNav),section:xf(fw,fillBlue),meta:xf(fm,fillPale),header:xf(fw,fillNav),total:xf(fb,fillPale),totalMoney:xf(fb,fillPale,61),totalKg:xf(fb,fillPale,62),card:xf(fb,fillPale),value:xf(fv,fillWhite),valueQty:xf(fv,fillWhite,62),red:xf(fr,fillRed),redMoney:xf(fr,fillRed,61),body:xf(fm,fillWhite),bodyMoney:xf(fm,fillWhite,61)};
 zip.FileIndex[stylesId].content=Buffer.from(xml,'utf8');
 for(let i=0;i<names.length;i++){const name=names[i],id=path(`xl/worksheets/sheet${i+1}.xml`);if(id<0)continue;const meta=metas.find(m=>m.nome===name);let body=zip.FileIndex[id].content.toString('utf8');
  body=body.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g,(full,attrs,col,line)=>{
   const r=+line;let n=null;
   if(name==='Resumo'){
    if(r===1||r===2)n=s.title;
    else if(r===3||r===14||r===32||r===43)n=s.section;
    else if([5,6].includes(r))n=s.meta;
    else if(r===9)n=s.card;
    else if(r===11)n=col==='E'?s.redMoney:col==='C'?s.valueQty:s.value;
    else if(r===34)n=s.header;
    else if(r>=35&&r<=41)n=['D','J'].includes(col)?s.bodyMoney:s.body;
    else if(r>=44&&r<=45)n=(r===44&&col==='G')?s.totalMoney:(r===45&&col==='G')?s.totalKg:s.total;
   }else if(r===1)n=s.title;else if(r===meta.header)n=s.header;else if(r===meta.total)n=s.total;else if(r%2===0&&r>meta.header)n=s.body;
   if(n===null)return full;
   // Preservar o numFmtId de moeda / quantidade para não perder os dados numéricos.
   const hasCustom=/\s+s="\d+"/.test(attrs);if(hasCustom&&r!==1&&r!==meta.header&&name!=='Resumo')return full;
   return '<c'+attrs.replace(/\s+s="\d+"/g,'')+` s="${n}">`;
  });
  // Congela o cabeçalho dos relatórios tabulares; Resumo permanece livre.
  if(name!=='Resumo' && meta.header){const topLeft=`A${meta.header+1}`;body=body.replace(/<sheetView workbookViewId="0"\/>/,`<sheetView workbookViewId="0"><pane ySplit="${meta.header}" topLeftCell="${topLeft}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${topLeft}" sqref="${topLeft}"/></sheetView>`);}
  if(name==='Resumo'){body=body.replace(/<autoFilter[^>]*\/>/g,'');body=body.replace(/<sheetView([^>]*)\/>/, (full,attrs)=>'<sheetView'+attrs+' showGridLines="0"/>');}
  // Rodape de impressao do Excel: visivel apenas na visualizacao/impressao, sem alterar celulas.
  if(!/<headerFooter\b/.test(body)){
   const footer='&amp;LControle de Avarias - V26.2&amp;CCriador: Wesley&amp;RPagina &amp;P de &amp;N';
   body=body.replace(/(<drawing\b|<legacyDrawing\b|<tableParts\b|<extLst\b|<\/worksheet>)/,
     m=>`<headerFooter><oddFooter>${footer}</oddFooter></headerFooter>${m}`);
  }
  zip.FileIndex[id].content=Buffer.from(body,'utf8');
 }
 // Os gráficos são desenhados como gráficos nativos de Excel, editáveis via Dados -> Selecionar Dados.
 try{adicionarGraficos(zip,names,d);}catch(e){console.warn('Gráficos nativos indisponíveis:',e.message);}
 return CFB.write(zip,{type:'buffer',fileType:'zip'});
}
function adicionarGraficos(zip,names,d){
 if(!d.evolucao.length)return;const find=s=>zip.FullPaths.findIndex(p=>p.endsWith('/'+s));const get=s=>{const i=find(s);if(i<0)throw Error(s);return zip.FileIndex[i].content.toString('utf8')};const set=(s,data)=>{const i=find(s);if(i<0)CFB.utils.cfb_add(zip,s,Buffer.from(data));else zip.FileIndex[i].content=Buffer.from(data)};
 const ei=names.indexOf('Evolução')+1,si=names.indexOf('Por Setor')+1; if(!ei||!si)return;
 const q=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 function series(cat,val,labels,values,donut=false){const colors=['21509C','4384BC','8FAECF','BDCEDC','C72B38','EAA23E','398166'];const dots=donut?labels.map((_,i)=>`<c:dPt><c:idx val="${i}"/><c:spPr><a:solidFill><a:srgbClr val="${colors[i%colors.length]}"/></a:solidFill></c:spPr></c:dPt>`).join(''):'<c:spPr><a:solidFill><a:srgbClr val="21509C"/></a:solidFill></c:spPr>';return `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Valor (R$)</c:v></c:tx>${dots}<c:cat><c:strRef><c:f>${cat}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${labels.map((v,i)=>`<c:pt idx="${i}"><c:v>${q(v)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${val}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v,i)=>`<c:pt idx="${i}"><c:v>${Number(v)||0}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val></c:ser>`;}
 function chartXml(type,cat,val,labels,values){let content;if(type==='bar')content=`<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>${series(cat,val,labels,values)}<c:axId val="111"/><c:axId val="222"/></c:barChart><c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="222"/><c:tickLblPos val="nextTo"/></c:catAx><c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:crossAx val="111"/><c:crosses val="autoZero"/></c:valAx>`;else content=`<c:doughnutChart><c:varyColors val="1"/>${series(cat,val,labels,values,true)}<c:holeSize val="61"/><c:firstSliceAng val="270"/></c:doughnutChart>`;
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:lang val="pt-BR"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>${content}</c:plotArea>${type==='donut'?'<c:legend><c:legendPos val="r"/><c:layout/></c:legend>':''}<c:plotVisOnly val="0"/></c:chart></c:chartSpace>`;}
 const ev=d.evolucao.slice(-11),sector=topComOutros(d.setores,5),evFrom=d.evolucao.length-ev.length+6;
 set('xl/charts/chart1.xml',chartXml('bar',`'Evolução'!$A$${evFrom}:$A$${evFrom+ev.length-1}`,`'Evolução'!$D$${evFrom}:$D$${evFrom+ev.length-1}`,ev.map(v=>v.nome.slice(8,10)+'/'+v.nome.slice(5,7)),ev.map(v=>v.valor)));
 set('xl/charts/chart2.xml',chartXml('donut',`'Resumo'!$K$52:$K$${51+sector.length}`,`'Resumo'!$L$52:$L$${51+sector.length}`,sector.map(v=>v.nome),sector.map(v=>v.valor)));
 const ax=(col,row)=>`<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`;
 const to=(col,row)=>`<xdr:to><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`;
 const draw=(id,fromC,toC)=>`<xdr:twoCellAnchor>${ax(fromC,15)}${to(toC,29)}<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id+1}" name="Gráfico ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${id}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
 set('xl/drawings/drawing1.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${draw(1,0,7)}${draw(2,7,12)}</xdr:wsDr>`);
 set('xl/drawings/_rels/drawing1.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/></Relationships>`);
 const summarySheet=`xl/worksheets/sheet${names.indexOf('Resumo')+1}.xml`;
 let ss=get(summarySheet);ss=ss.replace('</worksheet>','<drawing r:id="rId200"/></worksheet>');if(!ss.includes('xmlns:r='))ss=ss.replace('<worksheet ','<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');set(summarySheet,ss);
 const sheetRel=`xl/worksheets/_rels/sheet${names.indexOf('Resumo')+1}.xml.rels`;
 const rel=find(sheetRel)>=0?get(sheetRel):'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
 set(sheetRel,rel.replace('</Relationships>','<Relationship Id="rId200" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'));
 let content=get('[Content_Types].xml');content=content.replace('</Types>','<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>');set('[Content_Types].xml',content);
}
module.exports={preparar,gerarPdf,criarPlanilha,qtd,medida};
