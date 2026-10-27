/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * RegistroAtividades.js - Módulo central de criação, edição, consulta e ciclo de vida do livro diário
 */

var RegistroAtividades = (function() {
  /**
   * Gera o próximo número sequencial oficial do registro (ex: LRA-2026-0001)
   */
  function generateNumeroRegistro(ano) {
    const anoAtual = ano || new Date().getFullYear();
    const prefixo = `LRA-${anoAtual}-`;

    const registros = Database.getAll('REGISTROS_ATIVIDADES');
    let maxSeq = 0;

    registros.forEach(r => {
      if (r.numero_registro && String(r.numero_registro).startsWith(prefixo)) {
        const numPart = parseInt(r.numero_registro.replace(prefixo, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefixo}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Verifica se já existe um registro ativo para a combinação (data_inicio, sgb, pb_id, prontidao)
   */
  function checkDuplicate(dataInicio, sgb, pbId, prontidao, excludeId = null) {
    const cleanData = String(dataInicio).trim();
    const cleanSgb = String(sgb).trim().toLowerCase();
    const cleanPb = String(pbId).trim().toLowerCase();
    const cleanPront = String(prontidao).trim().toLowerCase();

    const registros = Database.getAll('REGISTROS_ATIVIDADES');
    const existing = registros.find(r => {
      if (excludeId && String(r.id) === String(excludeId)) return false;
      if (r.status === Config.STATUS_REGISTRO.CANCELADO) return false;

      return String(r.data_inicio).trim() === cleanData &&
             String(r.sgb).trim().toLowerCase() === cleanSgb &&
             String(r.pb_id).trim().toLowerCase() === cleanPb &&
             String(r.prontidao).trim().toLowerCase() === cleanPront;
    });

    return existing || null;
  }

  /**
   * Cria um novo Registro de Atividades
   */
  function create(data, sessionUser) {
    Authorization.requirePermission(sessionUser, 'CRIAR_REGISTRO');

    if (!data.data_inicio) throw new Error('Data de início do serviço é obrigatória.');
    if (!data.sgb) throw new Error('SGB é obrigatório.');
    if (!data.pb_id) throw new Error('Posto de Bombeiros (PB) é obrigatório.');

    // Calcula o período de 24 horas e a prontidão exata
    const periodo = Prontidao.calcularPeriodoEProntidao(data.data_inicio, data.hora_inicio || Config.DEFAULT_HORA_INICIO);

    // Verifica duplicidade
    const dup = checkDuplicate(periodo.data_inicio, data.sgb, data.pb_id, periodo.prontidao);
    if (dup) {
      return {
        success: false,
        isDuplicate: true,
        existingId: dup.id,
        message: `Já existe um registro cadastrado para este serviço (${periodo.data_inicio}, ${data.sgb}, Prontidão ${periodo.prontidao}). Deseja abrir o registro existente?`
      };
    }

    // Busca detalhes do Posto de Bombeiros
    const posto = Unidades.getPostoById(data.pb_id);
    const pbNome = posto ? posto.nome : (data.pb_nome || 'PB');
    const grupamento = posto ? posto.grupamento_id : (data.grupamento || 'gb_15');

    // Busca detalhes do Comandante de Prontidão
    let cmtGrad = '';
    let cmtNome = '';
    let cmtReClean = '';
    if (data.cmt_re) {
      cmtReClean = Utils.normalizeRE(data.cmt_re);
      const militar = Militares.findByRE(cmtReClean);
      if (militar) {
        cmtGrad = militar.graduacao;
        cmtNome = militar.nome_completo;
      }
    }

    const ano = parseInt(periodo.data_inicio.split('-')[0], 10) || new Date().getFullYear();
    const numeroRegistro = generateNumeroRegistro(ano);
    const now = Utils.nowTimestamp();

    const record = {
      id: Utils.generateId('reg'),
      numero_registro: numeroRegistro,
      data_inicio: periodo.data_inicio,
      hora_inicio: periodo.hora_inicio,
      data_termino: periodo.data_termino,
      hora_termino: periodo.hora_termino,
      sgb: data.sgb,
      pb_id: data.pb_id,
      pb_nome: pbNome,
      grupamento: grupamento,
      prontidao: periodo.prontidao,
      cmt_re: cmtReClean,
      cmt_graduacao: cmtGrad,
      cmt_nome: cmtNome,
      status: data.isDraft ? Config.STATUS_REGISTRO.RASCUNHO : Config.STATUS_REGISTRO.EM_PREENCHIMENTO,
      criado_por: sessionUser.re,
      criado_em: now,
      atualizado_em: now,
      finalizado_em: ''
    };

    Database.insert('REGISTROS_ATIVIDADES', record);

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'CRIAR_REGISTRO',
      entidade: 'REGISTROS_ATIVIDADES',
      registro_id: record.id,
      resultado: 'SUCESSO',
      detalhes: `Registro ${numeroRegistro} criado para ${record.data_inicio} (${record.prontidao} - ${record.sgb} - ${pbNome})`
    });

    return {
      success: true,
      registro: record
    };
  }

  /**
   * Salva o registro completo (cabeçalho + seções fornecidas)
   */
  function saveComplete(registroId, payload, sessionUser) {
    Authorization.requirePermission(sessionUser, 'EDITAR_REGISTRO');

    const registro = Database.getById('REGISTROS_ATIVIDADES', registroId);
    if (!registro) throw new Error('Registro de Atividades não encontrado.');

    if (registro.status === Config.STATUS_REGISTRO.FINALIZADO) {
      throw new Error('Este registro está finalizado e não permite alterações diretas.');
    }
    if (registro.status === Config.STATUS_REGISTRO.CANCELADO) {
      throw new Error('Este registro está cancelado.');
    }

    const updates = {
      atualizado_em: Utils.nowTimestamp()
    };

    // Atualiza cabeçalho se fornecido
    if (payload.header) {
      const h = payload.header;
      if (h.cmt_re) {
        updates.cmt_re = Utils.normalizeRE(h.cmt_re);
        const mil = Militares.findByRE(updates.cmt_re);
        if (mil) {
          updates.cmt_graduacao = mil.graduacao;
          updates.cmt_nome = mil.nome_completo;
        }
      }
      if (h.status && Object.values(Config.STATUS_REGISTRO).includes(h.status)) {
        updates.status = h.status;
      }
    }

    Database.update('REGISTROS_ATIVIDADES', registroId, updates);

    // Salva as seções se presentes no payload
    if (payload.pessoal) SecoesOperacionais.savePessoal(registroId, payload.pessoal);
    if (payload.materiais_belicos) SecoesOperacionais.saveMateriaisBelicos(registroId, payload.materiais_belicos);
    if (payload.novidades_materiais) SecoesOperacionais.saveNovidadesMateriais(registroId, payload.novidades_materiais);
    if (payload.viaturas) SecoesOperacionais.saveViaturas(registroId, payload.viaturas);
    if (payload.ordem_dia !== undefined) SecoesOperacionais.saveOrdemDia(registroId, payload.ordem_dia);
    if (payload.ordens_recebidas) SecoesOperacionais.saveOrdensRecebidas(registroId, payload.ordens_recebidas);
    if (payload.treinamentos) SecoesOperacionais.saveTreinamentos(registroId, payload.treinamentos);
    if (payload.manutencao) SecoesOperacionais.saveManutencao(registroId, payload.manutencao);
    if (payload.ocorrencias !== undefined) SecoesOperacionais.saveOcorrencias(registroId, payload.ocorrencias);
    if (payload.rondas) SecoesOperacionais.saveRondas(registroId, payload.rondas);

    // Assinatura digital automática para Cmt que entra (vinculado ao militar logado ou informado)
    if (sessionUser && sessionUser.re) {
      try {
        const obsEntra = (payload.conferencias && payload.conferencias.cmt_entra_obs) || 'Assinatura digital automática na gravação do livro';
        const cmtEntraRe = (payload.conferencias && payload.conferencias.cmt_entra_re) ? payload.conferencias.cmt_entra_re : sessionUser.re;
        Conferencias.validarConferencia(registroId, 'cmt_entra', sessionUser, obsEntra, cmtEntraRe);
      } catch (e) {}
    }

    // Processa conferências adicionais informadas no formulário (Modo Testes / Operacional)
    if (payload.conferencias) {
      if (payload.conferencias.cmt_sai_re) {
        try {
          Conferencias.validarConferencia(registroId, 'cmt_sai', sessionUser, payload.conferencias.cmt_sai_obs || 'Conferência realizada', payload.conferencias.cmt_sai_re);
        } catch (e) {}
      }
      if (payload.conferencias.cmt_pb_re) {
        try {
          Conferencias.validarConferencia(registroId, 'cmt_pb', sessionUser, payload.conferencias.cmt_pb_obs || 'Conferência realizada', payload.conferencias.cmt_pb_re);
        } catch (e) {}
      }
    }

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'EDITAR_REGISTRO',
      entidade: 'REGISTROS_ATIVIDADES',
      registro_id: registroId,
      resultado: 'SUCESSO',
      detalhes: `Registro ${registro.numero_registro} atualizado com sucesso`
    });

    return getById(registroId);
  }

  /**
   * Obtém um registro com todas as 12 seções e conferências estruturadas
   */
  function getById(registroId) {
    const registro = Database.getById('REGISTROS_ATIVIDADES', registroId);
    if (!registro) return null;

    return {
      header: registro,
      pessoal: SecoesOperacionais.getPessoal(registroId),
      materiais_belicos: SecoesOperacionais.getMateriaisBelicos(registroId),
      novidades_materiais: SecoesOperacionais.getNovidadesMateriais(registroId),
      viaturas: SecoesOperacionais.getViaturas(registroId),
      ordem_dia: SecoesOperacionais.getOrdemDia(registroId),
      ordens_recebidas: SecoesOperacionais.getOrdensRecebidas(registroId),
      treinamentos: SecoesOperacionais.getTreinamentos(registroId),
      manutencao: SecoesOperacionais.getManutencao(registroId),
      ocorrencias: SecoesOperacionais.getOcorrencias(registroId),
      rondas: SecoesOperacionais.getRondas(registroId),
      conferencias: Conferencias.getConferencias(registroId)
    };
  }

  /**
   * Finaliza o registro de atividades
   */
  function finalizar(registroId, sessionUser) {
    Authorization.requirePermission(sessionUser, 'FINALIZAR_REGISTRO');

    const registro = Database.getById('REGISTROS_ATIVIDADES', registroId);
    if (!registro) throw new Error('Registro não encontrado.');

    if (registro.status === Config.STATUS_REGISTRO.FINALIZADO) {
      throw new Error('O registro já se encontra finalizado.');
    }

    const confs = Conferencias.getConferencias(registroId);
    // Para finalização oficial, exige conferência do Cmt do PB ou ao menos 1 conferência
    if (!confs.cmt_pb && sessionUser.perfil !== Config.ROLES.ADMIN) {
      throw new Error('A finalização requer a conferência formal do Comandante do Posto de Bombeiros.');
    }

    const now = Utils.nowTimestamp();
    const updated = Database.update('REGISTROS_ATIVIDADES', registroId, {
      status: Config.STATUS_REGISTRO.FINALIZADO,
      finalizado_em: now,
      atualizado_em: now
    });

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'FINALIZAR_REGISTRO',
      entidade: 'REGISTROS_ATIVIDADES',
      registro_id: registroId,
      resultado: 'SUCESSO',
      detalhes: `Registro ${registro.numero_registro} finalizado oficialmente`
    });

    return updated;
  }

  /**
   * Cancela um registro (apenas administrador)
   */
  function cancelar(registroId, motivo, sessionUser) {
    Authorization.requirePermission(sessionUser, 'CANCELAR_REGISTRO');

    const registro = Database.getById('REGISTROS_ATIVIDADES', registroId);
    if (!registro) throw new Error('Registro não encontrado.');

    if (!motivo || String(motivo).trim().length < 5) {
      throw new Error('É obrigatório informar o motivo detalhado do cancelamento.');
    }

    const now = Utils.nowTimestamp();
    const updated = Database.update('REGISTROS_ATIVIDADES', registroId, {
      status: Config.STATUS_REGISTRO.CANCELADO,
      atualizado_em: now
    });

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'CANCELAR_REGISTRO',
      entidade: 'REGISTROS_ATIVIDADES',
      registro_id: registroId,
      resultado: 'SUCESSO',
      detalhes: `Registro ${registro.numero_registro} cancelado. Motivo: ${motivo}`
    });

    return updated;
  }

  /**
   * Lista registros com filtros avançados e paginação
   */
  function queryRegistros(filters = {}, sessionUser) {
    let list = Database.getAll('REGISTROS_ATIVIDADES');

    // Filtros
    if (filters.numero_registro) {
      const numTarget = String(filters.numero_registro).trim().toLowerCase();
      list = list.filter(r => String(r.numero_registro || '').toLowerCase().includes(numTarget));
    }
    if (filters.data_inicio) {
      list = list.filter(r => r.data_inicio >= filters.data_inicio);
    }
    if (filters.data_fim) {
      list = list.filter(r => r.data_inicio <= filters.data_fim);
    }
    if (filters.prontidao) {
      const prontTarget = String(filters.prontidao).trim().toLowerCase();
      list = list.filter(r => String(r.prontidao).toLowerCase() === prontTarget);
    }
    if (filters.sgb) {
      const sgbTarget = String(filters.sgb).trim().toLowerCase();
      list = list.filter(r => String(r.sgb).toLowerCase() === sgbTarget);
    }
    if (filters.pb_id) {
      const pbTarget = String(filters.pb_id).trim().toLowerCase();
      list = list.filter(r => String(r.pb_id).toLowerCase() === pbTarget);
    }
    if (filters.status) {
      const statusTarget = String(filters.status).trim().toLowerCase();
      list = list.filter(r => String(r.status).toLowerCase() === statusTarget);
    }
    if (filters.cmt_re) {
      const reTarget = Utils.normalizeRE(filters.cmt_re);
      list = list.filter(r => Utils.normalizeRE(r.cmt_re) === reTarget);
    }

    // Ordenação decrescente por data_inicio
    list.sort((a, b) => {
      const cmp = String(b.data_inicio).localeCompare(String(a.data_inicio));
      if (cmp !== 0) return cmp;
      return String(b.numero_registro).localeCompare(String(a.numero_registro));
    });

    const total = list.length;
    const page = parseInt(filters.page, 10) || 1;
    const pageSize = parseInt(filters.pageSize, 10) || 15;
    const startIndex = (page - 1) * pageSize;
    const paginated = list.slice(startIndex, startIndex + pageSize);

    return {
      items: paginated,
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  return {
    generateNumeroRegistro: generateNumeroRegistro,
    checkDuplicate: checkDuplicate,
    create: create,
    saveComplete: saveComplete,
    getById: getById,
    finalizar: finalizar,
    cancelar: cancelar,
    queryRegistros: queryRegistros
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RegistroAtividades;
}
