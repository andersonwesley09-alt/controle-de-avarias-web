(() => {
  const form=document.getElementById('formProdutoLocal'); if(!form)return;
  const val=id=>document.getElementById(id)?.value ?? '';
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const codigo=String(val('produtoLocalCodigo')).trim(), produto=String(val('produtoLocalDescricao')).trim();
    if(!codigo||!produto)return;
    const produtos=JSON.parse(localStorage.getItem('produtos')||'[]');
    if(produtos.some(p=>String(p.codigo)===codigo)){alert('Esse produto já está cadastrado.');return;}
    produtos.push({codigo,produto,descricao:produto,fornecedor:val('produtoLocalFornecedor').trim(),codigoFornecedor:val('produtoLocalCodigoFornecedor').trim(),valorCusto:Number(val('produtoLocalCusto'))||0,valorVenda:Number(val('produtoLocalVenda'))||0,categoria:val('produtoLocalCategoria'),estoque:Number(val('produtoLocalEstoque'))||0,ativo:true,atualizadoEm:new Date().toISOString()});
    localStorage.setItem('produtos',JSON.stringify(produtos));
    form.reset(); document.getElementById('produtoLocalCusto').value='0'; document.getElementById('produtoLocalVenda').value='0'; document.getElementById('produtoLocalEstoque').value='0';
    alert('Produto cadastrado localmente.');
    try{const r=await fetch(`${location.origin}/api/produtos/resumo`);const d=await r.json();document.getElementById('totalProdutos').textContent=d.total;document.getElementById('produtosAtivos').textContent=d.ativos;}catch{}
  });
})();
