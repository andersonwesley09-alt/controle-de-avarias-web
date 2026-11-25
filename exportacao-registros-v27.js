'use strict';
/* Controle de Avarias V27 - Relatórios configuráveis de Registros.
   Sem escrita no banco. Dados devem ser consultados pelo servidor via IDs. */
const XLSX = require('xlsx');
const COLUNAS_VALIDAS = ['fornecedor','categoria','setor','motivo','custo'];
const quant = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const centavos = n => Math.round((quant(n) + Number.EPSILON) * 100);
const brl = v => (quant(v)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function normalizarCodigo(codigo) {
  const v=String(codigo??'').trim();
  return /^\d+$/.test(v) ? (v.replace(/^0+(?=\d)/,'') || '0') : v.toUpperCase();
}
function classificarUnidade(texto) {
  const u=String(texto??'').trim().toUpperCase();
  if (['KG','KGS','QUILO','QUILOS','QUILOGRAMA','QUILOGRAMAS'].includes(u))return 'KG';
  if (['UN','UND','UNID','UNIDADE','UNIDADES','UN.','PC','PÇ','PÇS','PEÇA'].includes(u))return 'UND';
  if (['L','LT','LITRO','LITROS'].includes(u))return 'L';
  return u ? u.slice(0,12) : 'Sem U.M.';
}
function formatarQuantidade(n,unidade){
  const v=quant(n);
  if(unidade==='UND')return v.toLocaleString('pt-BR',{maximumFractionDigits:0});
  return v.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3});
}
const seguroExcel = v => {
  const s=String(v??'');
  return /^[=+@]/.test(s) ? `'${s}` : s;
};
function prepararRelatorio(registros,op={}) {
  if(!Array.isArray(registros)||!registros.length)throw new Error('Nenhum registro disponível para exportar.');
  const tipo=op.tipo==='detalhado'?'detalhado':'consolidado';
  const colunas=(Array.isArray(op.colunas)?op.colunas:COLUNAS_VALIDAS).filter(c=>COLUNAS_VALIDAS.includes(c));
  const totais=op.totais!==false;
  const processados=registros.map(r=>{
    const qtd=quant(r.quantidade),valor=centavos(r.valorTotal??(quant(r.valorUnitario)*qtd));
    return {
      codigo:String(r.codigo??'').trim(),produto:String(r.produto??'').trim(),
      fornecedor:String(r.fornecedor??'').trim(),categoria:String(r.categoria??'').trim(),
      setor:String(r.setor??'').trim(),motivo:String(r.tipo??r.motivo??'').trim(),
      data:String(r.data??'').trim(),qtd,valorCentavos:valor,
      custo:quant(r.valorUnitario),unidade:classificarUnidade(r.unidadeMedida??r.unidade)
    };
  });
  let linhas;
  if(tipo==='detalhado')linhas=processados.map(r=>({...r,ocorrencias:1}));
  else {
    const mapa=new Map();
    for(const r of processados){
      const chave=`${normalizarCodigo(r.codigo)||'PRODUTO:'+r.produto.toLocaleUpperCase('pt-BR')}\x1F${r.unidade}`;
      if(!mapa.has(chave))mapa.set(chave,{...r,ocorrencias:0,_atributos:{}});
      const a=mapa.get(chave);
      if(a.ocorrencias){a.qtd+=r.qtd;a.valorCentavos+=r.valorCentavos;}
      a.ocorrencias++;
      for(const coluna of ['produto','fornecedor','categoria','setor','motivo']) {
        if(!a._atributos[coluna])a._atributos[coluna]=new Set();
        if(r[coluna])a._atributos[coluna].add(r[coluna]);
      }
    }
    linhas=[...mapa.values()].map(a=>{
      for(const c of ['produto','fornecedor','categoria','setor','motivo']) {
        const opcoes=[...a._atributos[c]];
        a[c]=opcoes.length>1?(c==='produto'?a.produto:'Diversos'):(opcoes[0]||'');
      }
      delete a._atributos;
      a.custo=a.qtd? a.valorCentavos/100/a.qtd:0;
      return a;
    });
  }
  const totaisPorUnidade={};
  for(const r of processados){totaisPorUnidade[r.unidade]=(totaisPorUnidade[r.unidade]||0)+r.qtd;}
  const valorCentavos=processados.reduce((t,r)=>t+r.valorCentavos,0);
  const headers=[];
  const specs=[];
  const add=(key,label,width,fn,formato)=>{headers.push(label);specs.push({key,label,width,fn,formato});};
  if(tipo==='detalhado')add('data','Data',105,r=>r.data);
  add('codigo','Código do produto',125,r=>seguroExcel(r.codigo));
  add('produto','Produto',260,r=>seguroExcel(r.produto));
  if(colunas.includes('fornecedor'))add('fornecedor','Fornecedor',160,r=>seguroExcel(r.fornecedor));
  if(colunas.includes('categoria'))add('categoria','Categoria',112,r=>seguroExcel(r.categoria));
  if(colunas.includes('setor'))add('setor','Setor',100,r=>seguroExcel(r.setor));
  if(colunas.includes('motivo'))add('motivo','Motivo',115,r=>seguroExcel(r.motivo));
  add('quantidade','Quantidade',100,r=>r.qtd,'qtd');
  add('unidade','Unidade',105,r=>r.unidade);
  if(colunas.includes('custo'))add('custo','Custo unitário / médio',130,r=>r.custo,'moeda');
  add('valor','Valor total',132,r=>r.valorCentavos/100,'moeda');
  const hoje=new Date();
  return {tipo,colunas,totais,specs,linhas,quantidadeRegistros:processados.length,
    valorCentavos,totaisPorUnidade,criadoEm:hoje.toLocaleString('pt-BR'),escopo:op.escopo||'filtrados'};
}
function criarExcel(rel){
  const tipo=rel.tipo==='consolidado'?'CONSOLIDADO POR PRODUTO':'DETALHADO POR LANÇAMENTO';
  const linhas=[
    ['CONTROLE DE AVARIAS | EXPORTAÇÃO DE REGISTROS'],
    [`Tipo: ${tipo}   |   Abrangência: ${rel.escopo}   |   Emissão: ${rel.criadoEm}`],
    [`Lançamentos analisados: ${rel.quantidadeRegistros}   |   Produtos/linhas: ${rel.linhas.length}`],
    [], rel.specs.map(s=>s.label),
    ...rel.linhas.map(l=>rel.specs.map(s=>s.fn(l)))
  ];
  const iTotal=linhas.length;
  if(rel.totais){
    const r=rel.specs.map(s=>s.key==='produto'?'TOTAIS':s.key==='valor'?rel.valorCentavos/100:'');
    linhas.push(r);
  }
  const sheet=XLSX.utils.aoa_to_sheet(linhas);
  const lastCol=XLSX.utils.encode_col(rel.specs.length-1);
  sheet['!autofilter']={ref:`A5:${lastCol}${rel.linhas.length+5}`};
  sheet['!freeze']={xSplit:0,ySplit:5,topLeftCell:'A6',activePane:'bottomLeft',state:'frozen'};
  sheet['!cols']=rel.specs.map(s=>({wch:Math.min(48,Math.max(12,Math.ceil(s.width/7.3)))}));
  for(let ri=6;ri<=rel.linhas.length+5;ri++){
    rel.specs.forEach((s,ci)=>{
      const pos=`${XLSX.utils.encode_col(ci)}${ri}`;
      const c=sheet[pos];if(!c)return;
      if(s.formato==='moeda' && c.t==='n') c.z='"R$ "#,##0.00';
      if(s.formato==='qtd' && c.t==='n'){const u=rel.linhas[ri-6].unidade;const q=rel.linhas[ri-6].qtd;c.z=u==='UND'||Number.isInteger(q)?'#,##0':'#,##0.000';}
      if(s.key==='codigo'){c.t='s';c.v=String(c.v);c.z='@';}
    });
  }
  if(rel.totais){const c=sheet[`${XLSX.utils.encode_col(rel.specs.length-1)}${iTotal+1}`];if(c)c.z='"R$ "#,##0.00';}
  const info=[
    ['RESUMO DA EXPORTAÇÃO',''],['Tipo',tipo],['Abrangência',rel.escopo],
    ['Emissão',rel.criadoEm],['Lançamentos analisados',rel.quantidadeRegistros],
    ['Linhas de produtos',rel.linhas.length],['Valor total das perdas',rel.valorCentavos/100],[],
    ['QUANTIDADES POR UNIDADE',''],
    ...Object.entries(rel.totaisPorUnidade).sort((a,b)=>a[0].localeCompare(b[0])).map(([u,q])=>[u,q]),
    [],['Observação','UND e KG não são somados entre si. "Sem U.M." indica ausência de unidade no cadastro de produtos.'],
    ['Regra','O código é exibido como texto; zeros iniciais são comparados apenas para agrupar produtos.']
  ];
  const resumo=XLSX.utils.aoa_to_sheet(info);
  resumo['!cols']=[{wch:32},{wch:92}];
  const valor=resumo['B7'];if(valor)valor.z='"R$ "#,##0.00';
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet,'Registros');
  XLSX.utils.book_append_sheet(wb,resumo,'Resumo');
  return XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
}
function escPdf(s){
  return String(s??'').replace(/[^\x20-\xFF]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}
function criarPDF(rel){
  // V27.3 - Layout tabular com quebra real de linhas e alturas dinamicas.
  // Sem truncar datas, descricoes, codigos ou valores, inclusive em PDF detalhado.
  const W=842,H=595,M=22;
  const area=W-M*2;
  const baseLarguras={data:77,codigo:86,produto:188,fornecedor:130,categoria:82,setor:64,motivo:104,quantidade:65,unidade:75,custo:82,valor:86};
  const specs=rel.specs.map(s=>({...s,peso:baseLarguras[s.key]||80}));
  const pesoTotal=specs.reduce((t,s)=>t+s.peso,0);
  for(const s of specs)s.w=(s.peso/pesoTotal)*area;
  const paginas=[];let ops=[],y=420,index=0;
  const rect=(x,ly,w,h,fill)=>ops.push(`${fill} rg ${x.toFixed(1)} ${ly.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  const text=(str,x,ly,size=7,bold=false,color='0.12 0.16 0.27')=>ops.push(`${color} rg BT /${bold?'F2':'F1'} ${size.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(1)} ${ly.toFixed(1)} Tm (${escPdf(str)}) Tj ET`);
  // Estimativa conservadora de Helvetica 6.4 pt, para evitar qualquer invasao de coluna.
  function largura(str,sz){let v=0;for(const c of String(str)){v+=sz*(c===' '?0.29:/[MW@%]/.test(c)?0.86:/[ilI1.,:;|!]/.test(c)?0.30:/[A-Z0-9]/.test(c)?0.61:0.54);}return v;}
  function quebrar(valor,w,sz){
    const larguraMaxima=Math.max(5,w-8);
    const trechos=String(valor??'').replace(/\r/g,'').split('\n');
    const linhas=[];
    for(const trecho of trechos){
      let linha='';
      for(const palavra of (trecho.match(/\S+|\s+/g)||[])){
        if(/^\s+$/.test(palavra)){
          if(linha && !linha.endsWith(' '))linha+=' ';
          continue;
        }
        if(linha && largura(linha.trimEnd()+' '+palavra,sz)<=larguraMaxima){linha=linha.trimEnd()+' '+palavra;continue;}
        if(linha.trim()){linhas.push(linha.trim());linha='';}
        if(largura(palavra,sz)<=larguraMaxima){linha=palavra;continue;}
        // Códigos, datas e nomes compridos podem ser divididos sem perder caracteres.
        let segmento='';
        for(const c of palavra){
          if(segmento && largura(segmento+c,sz)>larguraMaxima){linhas.push(segmento);segmento='';}
          segmento+=c;
        }
        linha=segmento;
      }
      linhas.push(linha.trim());
    }
    return linhas.length?linhas:[''];
  }
  const titulo=s=>s.key==='custo'?(rel.tipo==='consolidado'?'Custo médio':'Custo un.'):s.label;
  function pagina(){
    ops=[];index++;
    rect(0,H-87,W,87,'0.036 0.117 0.38');
    text('EmpresaExemplo  |  CONTROLE DE AVARIAS',M,H-33,14,true,'1 1 1');
    text(rel.tipo==='consolidado'?'RELATÓRIO CONSOLIDADO POR PRODUTO':'RELATÓRIO DETALHADO DE REGISTROS',M,H-55,10,true,'1 1 1');
    text(`Emissão: ${rel.criadoEm}  |  Abrangência: ${rel.escopo}`,M,H-103,8,false);
    text(`Lançamentos: ${rel.quantidadeRegistros.toLocaleString('pt-BR')}  |  Linhas do relatório: ${rel.linhas.length.toLocaleString('pt-BR')}`,M,H-120,8,false);
    rect(M,422,area,33,'0.08 0.16 0.59');
    let x=M;
    for(const s of specs){
      const cabecalho=quebrar(titulo(s),s.w,6.6);
      cabecalho.slice(0,3).forEach((v,i)=>text(v,x+3,443-i*9,6.6,true,'1 1 1'));
      x+=s.w;
    }
    y=420;
  }
  function virar(){paginas.push(ops);pagina();}
  pagina();
  const fontSize=6.5,alturaLinha=9.2;
  rel.linhas.forEach((l,i)=>{
    const colunas=specs.map(s=>{
      let v=s.fn(l);
      if(s.formato==='qtd')v=formatarQuantidade(v,l.unidade);
      if(s.formato==='moeda')v=brl(v);
      return quebrar(v,s.w,fontSize);
    });
    const maximo=Math.max(...colunas.map(c=>c.length));
    // Se a linha inteira couber numa pagina nova, mova-a para nao parti-la.
    const alturaTotal=Math.max(20,maximo*alturaLinha+10);
    if(y-alturaTotal<58 && alturaTotal<=350)virar();
    let pos=0;
    while(pos<maximo){
      const disponibilidade=y-58;
      let quantidade=Math.floor((disponibilidade-10)/alturaLinha);
      if(quantidade<=0){virar();continue;}
      quantidade=Math.min(quantidade,maximo-pos);
      const altura=Math.max(20,quantidade*alturaLinha+10);
      if(i%2===1)rect(M,y-altura,area,altura,'0.948 0.958 0.982');
      let x=M;
      for(let j=0;j<specs.length;j++){
        const trecho=colunas[j].slice(pos,pos+quantidade);
        trecho.forEach((v,k)=>text(v,x+3,y-11-k*alturaLinha,fontSize,false));
        x+=specs[j].w;
      }
      y-=altura;
      pos+=quantidade;
      if(pos<maximo)virar();
    }
  });
  if(rel.totais){
    const blocos=[`Lançamentos: ${rel.quantidadeRegistros.toLocaleString('pt-BR')}`,`Produtos/linhas: ${rel.linhas.length.toLocaleString('pt-BR')}`,`Valor total: ${brl(rel.valorCentavos/100)}`];
    const unidades=Object.entries(rel.totaisPorUnidade).map(([u,q])=>`${u}: ${formatarQuantidade(q,u)}`);
    const celulas=[...blocos,...unidades];
    const tamanhoCol=(area-18)/3;
    const linhasTotais=celulas.map((v,i)=>({i,linhas:quebrar(v,tamanhoCol,8)}));
    const grupos=[];
    for(let i=0;i<linhasTotais.length;i+=3){const slice=linhasTotais.slice(i,i+3);grupos.push({celulas:slice,altura:Math.max(...slice.map(x=>x.linhas.length))*11+5});}
    const hTotal=29+grupos.reduce((t,g)=>t+g.altura,0)+8;
    if(y-hTotal<53)virar();
    // Ate mesmo totalizadores extensos podem continuar na pagina seguinte.
    let primeira=true;
    for(const grupo of grupos){
      const altura=grupo.altura+(primeira?34:5);
      if(y-altura<52)virar();
      rect(M,y-altura,area,altura,'0.904 0.935 0.992');
      if(primeira)text('TOTAIS DO RELATÓRIO',M+9,y-15,10,true,'0.06 0.17 0.44');
      grupo.celulas.forEach(({i,linhas})=>linhas.forEach((v,k)=>text(v,M+9+(i%3)*tamanhoCol,y-(primeira?36:12)-k*11,8,i<3)));
      y-=altura;primeira=false;
    }
  }
  paginas.push(ops);
  for(let i=0;i<paginas.length;i++){
    paginas[i].push(`0.24 0.31 0.45 rg BT /F1 7 Tf 1 0 0 1 ${M} 20 Tm (${escPdf('Controle de Avarias | V27.3 | Criador: Wesley')}) Tj ET`);
    paginas[i].push(`0.24 0.31 0.45 rg BT /F1 7 Tf 1 0 0 1 ${W-95} 20 Tm (${escPdf(`Página ${i+1} de ${paginas.length}`)}) Tj ET`);
  }
  const obj=[];const add=o=>{obj.push(o);return obj.length};
  const catalog=add('<< /Type /Catalog /Pages 2 0 R >>');const pagesId=add('PLACEHOLDER');
  const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids=[];
  for(const opsPage of paginas){
    const stream=opsPage.join('\n')+'\n';
    const content=add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  obj[pagesId-1]=`<< /Type /Pages /Kids [${kids.map(i=>`${i} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let pdf='%PDF-1.4\n';const offsets=[];
  for(let i=0;i<obj.length;i++){offsets[i+1]=Buffer.byteLength(pdf,'latin1');pdf+=`${i+1} 0 obj\n${obj[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf,'latin1');pdf+=`xref\n0 ${obj.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=obj.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${obj.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,'latin1');
}
module.exports={prepararRelatorio,criarExcel,criarPDF,normalizarCodigo,classificarUnidade,formatarQuantidade};
