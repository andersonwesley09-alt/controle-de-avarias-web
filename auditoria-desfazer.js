/* Reversões administrativas restritas de auditoria.
 * Não executa SQL a partir de nomes/colunas fornecidos pelo navegador.
 * A operação, seu marcador de idempotência e o histórico de reversão
 * são gravados na mesma transação PostgreSQL.
 */
const TIPOS = Object.freeze({
  'excluido|avaria': 'restaurar-avaria',
  'excluido|historico_avarias': 'restaurar-historico',
  'concluido|tarefa_diaria': 'reverter-tarefa',
  'reaberto|tarefa_diaria': 'reverter-tarefa',
  'editar|permissoes_usuario': 'reverter-permissoes'
});

function classificar(registro) {
  if (!registro || !registro.antes || !registro.registro_id) return null;
  const chave = `${String(registro.acao || '').toLowerCase()}|${String(registro.entidade || '').toLowerCase()}`;
  const tipo = TIPOS[chave] || null;
  if (!tipo) return null;
  if (tipo === 'restaurar-avaria' && (!registro.antes.id || !registro.antes.produto)) return null;
  if (tipo === 'restaurar-historico' && registro.antes.removido === true) return null;
  if (tipo === 'reverter-tarefa' && (typeof registro.antes.concluida !== 'boolean' || typeof registro.depois?.concluida !== 'boolean')) return null;
  if (tipo === 'reverter-permissoes' && (!registro.depois || typeof registro.depois !== 'object' || Array.isArray(registro.depois))) return null;
  return tipo;
}

const DESCRICOES = Object.freeze({
  'restaurar-avaria': 'Restaurar registro excluído na aba Registros',
  'restaurar-historico': 'Voltar a mostrar o registro no Histórico de Baixas',
  'reverter-tarefa': 'Reverter a última conclusão/reabertura da tarefa',
  'reverter-permissoes': 'Restaurar as permissões anteriores do usuário'
});

let promessaEstrutura = null;
function garantirEstrutura(pool) {
  if (!promessaEstrutura) {
    promessaEstrutura = pool.query(`
      CREATE TABLE IF NOT EXISTS auditoria_desfazimentos (
        auditoria_id BIGINT PRIMARY KEY REFERENCES auditoria_alteracoes(id) ON DELETE RESTRICT,
        desfeito_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        desfeito_por VARCHAR(100) NOT NULL,
        motivo TEXT NOT NULL,
        reversao_auditoria_id BIGINT REFERENCES auditoria_alteracoes(id) ON DELETE RESTRICT
      )
    `).catch(erro => { promessaEstrutura = null; throw erro; });
  }
  return promessaEstrutura;
}

function idRegistro(registro) {
  return String(registro.registro_id || '').trim();
}

async function aplicarReversao(cliente, tipo, registro) {
  const id = idRegistro(registro);
  if (tipo === 'restaurar-avaria') {
    const antes = registro.antes;
    if (String(antes.id) !== id) {
      const e = new Error('O identificador do registro não confere com a auditoria.'); e.status = 409; throw e;
    }
    if (!(Number(antes.quantidade) > 0) || !(Number(antes.valor_unitario) >= 0)) {
      const e = new Error('A auditoria antiga não possui quantidade/custo válido para restaurar.'); e.status = 409; throw e;
    }
    const jaExiste = await cliente.query('SELECT id FROM avarias WHERE id = $1 FOR UPDATE', [id]);
    if (jaExiste.rowCount) { const e = new Error('Esta avaria já existe. Nada foi alterado.'); e.status = 409; throw e; }
    const campos = ['id','codigo','produto','fornecedor','categoria','quantidade','valor_unitario','setor','tipo','caixa','usuario_lancamento','status','observacao','criado_em','movimentado_em'];
    const valores = campos.map(k => antes[k] === undefined ? null : antes[k]);
    const placeholders = campos.map((_,i) => `$${i+1}`).join(',');
    const restaurado = await cliente.query(`
      INSERT INTO avarias (${campos.join(',')}) VALUES (${placeholders})
      ON CONFLICT (id) DO NOTHING RETURNING id
    `, valores);
    if (restaurado.rowCount !== 1) { const e = new Error('Outra operação já restaurou esta avaria.'); e.status = 409; throw e; }
    return { acao:'avaria-restaurada', entidade:'avaria', id };
  }
  if (tipo === 'restaurar-historico') {
    const r = await cliente.query(`UPDATE historico_avarias SET removido = FALSE WHERE id = $1 AND removido = TRUE RETURNING id`,[id]);
    if (r.rowCount !== 1) { const e = new Error('A baixa já está visível ou não existe mais. Nada foi alterado.'); e.status = 409; throw e; }
    return { acao:'historico-restaurado', entidade:'historico_avarias', id };
  }
  if (tipo === 'reverter-tarefa') {
    const antes = registro.antes;
    const depois = registro.depois;
    const atual = await cliente.query(`SELECT id, concluida, concluida_em FROM tarefas_diarias WHERE id = $1 FOR UPDATE`,[id]);
    if (!atual.rowCount) { const e = new Error('A tarefa não existe mais.'); e.status = 409; throw e; }
    const tarefa = atual.rows[0];
    const dataIgual = (v1, v2) => (v1 == null && v2 == null) || (v1 != null && v2 != null && new Date(v1).getTime() === new Date(v2).getTime());
    if (tarefa.concluida !== depois.concluida || !dataIgual(tarefa.concluida_em, depois.concluida_em)) {
      const e = new Error('A tarefa mudou desde esta auditoria. Não é seguro desfazer.'); e.status = 409; throw e;
    }
    await cliente.query('UPDATE tarefas_diarias SET concluida = $2, concluida_em = $3 WHERE id = $1',[id, antes.concluida, antes.concluida_em || null]);
    return { acao:'tarefa-revertida', entidade:'tarefa_diaria', id };
  }
  if (tipo === 'reverter-permissoes') {
    const atual = await cliente.query('SELECT id, perfil, permissoes FROM usuarios WHERE id = $1 FOR UPDATE',[id]);
    if (!atual.rowCount || atual.rows[0].perfil === 'admin') { const e = new Error('Usuário ausente ou protegido.'); e.status = 409; throw e; }
    const corresponde = await cliente.query('SELECT $1::jsonb = $2::jsonb AS igual', [JSON.stringify(atual.rows[0].permissoes), JSON.stringify(registro.depois)]);
    if (!corresponde.rows[0]?.igual) { const e = new Error('As permissões foram alteradas novamente. Não é seguro desfazer.'); e.status = 409; throw e; }
    const anterior = registro.antes === 'legado' || registro.antes == null ? null : registro.antes;
    if (anterior !== null && (typeof anterior !== 'object' || Array.isArray(anterior))) {
      const e = new Error('Configuração anterior inválida.'); e.status = 409; throw e;
    }
    await cliente.query('UPDATE usuarios SET permissoes = $2::jsonb WHERE id = $1',[id, anterior === null ? null : JSON.stringify(anterior)]);
    return { acao:'permissoes-restauradas', entidade:'usuarios', id };
  }
  const e = new Error('Esta operação não possui reversão segura disponível.'); e.status = 422; throw e;
}

function instalar({app, pool, exigirAdmin, garantirTabelaAuditoria, emitirEventoSistema}) {
  app.post('/api/auditoria/:id/desfazer', exigirAdmin, async (req,res) => {
    if (req.usuarioAdmin?.perfil !== 'admin') return res.status(403).json({erro:'Somente administradores podem desfazer alterações.'});
    const id = String(req.params.id || '').trim();
    const motivo = String(req.body?.motivo || '').trim();
    if (!/^\d{1,19}$/.test(id)) return res.status(400).json({erro:'Registro de auditoria inválido.'});
    if (motivo.length < 8 || motivo.length > 500) return res.status(400).json({erro:'Informe o motivo do desfazimento (8 a 500 caracteres).'});
    let cliente;
    let evento = null;
    try {
      await garantirTabelaAuditoria();
      await garantirEstrutura(pool);
      cliente = await pool.connect();
      await cliente.query('BEGIN');
      const original = await cliente.query('SELECT * FROM auditoria_alteracoes WHERE id=$1 FOR UPDATE',[id]);
      if (!original.rowCount) { const e = new Error('Auditoria não encontrada.'); e.status = 404; throw e; }
      const item = original.rows[0];
      const tipo = classificar(item);
      if (!tipo) { const e = new Error('Esta ação não tem dados suficientes para ser desfeita com segurança.'); e.status = 422; throw e; }
      const jaDesfeito = await cliente.query('SELECT auditoria_id FROM auditoria_desfazimentos WHERE auditoria_id = $1',[id]);
      if (jaDesfeito.rowCount) { const e = new Error('Esta alteração já foi desfeita.'); e.status = 409; throw e; }
      const posteriores = await cliente.query(`SELECT id FROM auditoria_alteracoes WHERE entidade = $1 AND registro_id = $2 AND id > $3 ORDER BY id ASC LIMIT 1`,[item.entidade,item.registro_id,id]);
      if (posteriores.rowCount) { const e = new Error('Há alterações posteriores neste registro. Desfaça primeiro a mais recente, quando disponível.'); e.status = 409; throw e; }
      evento = await aplicarReversao(cliente,tipo,item);
      const usuario = String(req.usuarioAdmin.usuario || 'admin');
      const detalhe = `Desfeito registro de auditoria #${id} (${item.acao} / ${item.entidade} / ${item.registro_id}). Motivo: ${motivo}`;
      const gravacao = await cliente.query(`INSERT INTO auditoria_alteracoes (acao,entidade,registro_id,usuario,antes,depois,detalhes) VALUES ('DESFAZER',$1,$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING id`,[item.entidade,item.registro_id,usuario,JSON.stringify(item.depois),JSON.stringify(item.antes),detalhe]);
      await cliente.query(`INSERT INTO auditoria_desfazimentos (auditoria_id,desfeito_por,motivo,reversao_auditoria_id) VALUES ($1,$2,$3,$4)`,[id,usuario,motivo,gravacao.rows[0].id]);
      await cliente.query('COMMIT');
      cliente.release(); cliente = null;
      if (tipo === 'restaurar-avaria') { emitirEventoSistema('avarias-atualizadas', evento); emitirEventoSistema('historico-atualizado', evento); }
      if (tipo === 'restaurar-historico') emitirEventoSistema('historico-atualizado', evento);
      if (tipo === 'reverter-tarefa') emitirEventoSistema('tarefas-atualizadas', evento);
      if (tipo === 'reverter-permissoes') emitirEventoSistema('usuarios-atualizados', evento);
      emitirEventoSistema('auditoria-atualizada', {acao:'desfeito',origem:id});
      return res.json({ok:true,desfeito:id,evento,registroAuditoria:String(gravacao.rows[0].id)});
    } catch (erro) {
      if (cliente) { try { await cliente.query('ROLLBACK'); } catch {} }
      console.error('Desfazer auditoria:',erro);
      return res.status(erro.status || 500).json({erro: erro.status ? erro.message : 'Não foi possível desfazer. Consulte o terminal do servidor.'});
    } finally { if (cliente) cliente.release(); }
  });
}

module.exports={classificar,DESCRICOES,garantirEstrutura,instalar};
