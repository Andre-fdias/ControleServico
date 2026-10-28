/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * SecoesOperacionais.js - Gerenciamento e persistência das 12 seções do formulário oficial
 */

var SecoesOperacionais = (function() {
  /**
   * Salva a Seção 1 - Novidade de Pessoal com Autossoma via Complementos
   */
  function savePessoal(registroId, data) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    const complementosList = Array.isArray(data.complementos) ? data.complementos : [];

    // Calcula a autossoma por categoria a partir dos complementos informados
    let faltaCount = 0;
    let folgaCount = 0;
    let trocaCount = 0;
    let baixasCount = 0;
    let visitantesCount = 0;
    let licencaCount = 0;
    let restricaoCount = 0;
    let estagiariosCount = 0;

    if (complementosList.length > 0) {
      complementosList.forEach(item => {
        const cat = String(item.categoria || '').trim().toLowerCase();
        if (cat === 'falta') faltaCount++;
        else if (cat === 'folga') folgaCount++;
        else if (cat === 'troca' || cat.includes('troca')) trocaCount++;
        else if (cat === 'baixas' || cat === 'baixa') baixasCount++;
        else if (cat === 'visitantes' || cat === 'visitante') visitantesCount++;
        else if (cat.includes('licença') || cat.includes('convalescença') || cat.includes('licenca')) licencaCount++;
        else if (cat.includes('restrição') || cat.includes('restricao')) restricaoCount++;
        else if (cat.includes('estagiário') || cat.includes('estagiario') || cat.includes('estagiários')) estagiariosCount++;
      });
    } else {
      // Fallback para valores diretos caso não haja complementos detalhados
      faltaCount = Utils.parseNonNegativeInt(data.falta, 0);
      folgaCount = Utils.parseNonNegativeInt(data.folga, 0);
      trocaCount = Utils.parseNonNegativeInt(data.troca, 0);
      baixasCount = Utils.parseNonNegativeInt(data.baixas, 0);
      visitantesCount = Utils.parseNonNegativeInt(data.visitantes, 0);
      licencaCount = Utils.parseNonNegativeInt(data.licenca_convalescenca, 0);
      restricaoCount = Utils.parseNonNegativeInt(data.restricao, 0);
      estagiariosCount = Utils.parseNonNegativeInt(data.estagiarios, 0);
    }

    const cleanData = {
      registro_id: registroId,
      falta: faltaCount,
      folga: folgaCount,
      troca: trocaCount,
      baixas: baixasCount,
      visitantes: visitantesCount,
      licenca_convalescenca: licencaCount,
      restricao: restricaoCount,
      estagiarios: estagiariosCount,
      complemento: String(data.complemento || '').trim(),
      atualizado_em: Utils.nowTimestamp()
    };

    const existing = Database.find('NOVIDADES_PESSOAL', p => String(p.registro_id) === String(registroId));
    if (existing && existing.length > 0) {
      Database.update('NOVIDADES_PESSOAL', existing[0].id, cleanData);
    } else {
      cleanData.id = Utils.generateId('pes');
      Database.insert('NOVIDADES_PESSOAL', cleanData);
    }

    // Persiste os complementos detalhados na tabela COMPLEMENTOS_PESSOAL
    Database.deleteWhere('COMPLEMENTOS_PESSOAL', { registro_id: registroId });
    if (complementosList.length > 0) {
      const compBatch = complementosList.map(c => {
        const milRe = Utils.normalizeRE(c.militar_re || c.re || '');
        const saiRe = Utils.normalizeRE(c.militar_sai_re || c.sai_re || '');
        const entraRe = Utils.normalizeRE(c.militar_entra_re || c.entra_re || '');
        return {
          id: Utils.generateId('cpes'),
          registro_id: registroId,
          categoria: String(c.categoria || '').trim(),
          militar_re: milRe,
          militar_graduacao: String(c.militar_graduacao || c.graduacao || '').trim(),
          militar_nome: String(c.militar_nome || c.nome_completo || c.nome || '').trim(),
          motivo: String(c.motivo || c.observacao || '').trim(),
          militar_sai_re: saiRe,
          militar_sai_graduacao: String(c.militar_sai_graduacao || c.sai_graduacao || '').trim(),
          militar_sai_nome: String(c.militar_sai_nome || c.sai_nome || '').trim(),
          militar_sai_prontidao: String(c.militar_sai_prontidao || c.sai_prontidao || '').trim(),
          militar_entra_re: entraRe,
          militar_entra_graduacao: String(c.militar_entra_graduacao || c.entra_graduacao || '').trim(),
          militar_entra_nome: String(c.militar_entra_nome || c.entra_nome || '').trim(),
          militar_entra_prontidao: String(c.militar_entra_prontidao || c.entra_prontidao || '').trim(),
          periodo_horas: String(c.periodo_horas || c.periodo || '').trim(),
          atualizado_em: Utils.nowTimestamp()
        };
      });
      Database.insertBatch('COMPLEMENTOS_PESSOAL', compBatch);
    }

    return getPessoal(registroId);
  }

  /**
   * Obtém a Seção 1 - Novidade de Pessoal com complementos e autossoma
   */
  function getPessoal(registroId) {
    const list = Database.find('NOVIDADES_PESSOAL', p => String(p.registro_id) === String(registroId));
    const rawComplementos = Database.find('COMPLEMENTOS_PESSOAL', c => String(c.registro_id) === String(registroId));

    const complementos = rawComplementos.map(c => {
      let displayFormatado = Utils.formatMilitarDisplay(c.militar_graduacao, c.militar_re, '', c.militar_nome);
      const catLower = String(c.categoria || '').toLowerCase();
      if (catLower.includes('troca')) {
        const saiGrad = c.militar_sai_graduacao ? (c.militar_sai_graduacao.split('—')[0].trim() || c.militar_sai_graduacao) : '';
        const entraGrad = c.militar_entra_graduacao ? (c.militar_entra_graduacao.split('—')[0].trim() || c.militar_entra_graduacao) : '';
        const saiDisp = [saiGrad, c.militar_sai_re ? `RE ${c.militar_sai_re}` : '', c.militar_sai_nome].filter(Boolean).join(' ');
        const entraDisp = [entraGrad, c.militar_entra_re ? `RE ${c.militar_entra_re}` : '', c.militar_entra_nome].filter(Boolean).join(' ');
        displayFormatado = `SAI: ${saiDisp || '-'} [${c.militar_sai_prontidao || 'Sem prontidão'}] ➔ ENTRA: ${entraDisp || '-'} [${c.militar_entra_prontidao || 'Sem prontidão'}] (${c.periodo_horas || '24 Horas'})`;
      }
      return {
        id: c.id,
        categoria: c.categoria,
        militar_re: c.militar_re,
        militar_graduacao: c.militar_graduacao,
        militar_nome: c.militar_nome,
        motivo: c.motivo,
        militar_sai_re: c.militar_sai_re || '',
        militar_sai_graduacao: c.militar_sai_graduacao || '',
        militar_sai_nome: c.militar_sai_nome || '',
        militar_sai_prontidao: c.militar_sai_prontidao || '',
        militar_entra_re: c.militar_entra_re || '',
        militar_entra_graduacao: c.militar_entra_graduacao || '',
        militar_entra_nome: c.militar_entra_nome || '',
        militar_entra_prontidao: c.militar_entra_prontidao || '',
        periodo_horas: c.periodo_horas || '',
        display_formatado: displayFormatado
      };
    });

    if (list && list.length > 0) {
      const p = list[0];
      return {
        falta: Utils.parseNonNegativeInt(p.falta, 0),
        folga: Utils.parseNonNegativeInt(p.folga, 0),
        troca: Utils.parseNonNegativeInt(p.troca, 0),
        baixas: Utils.parseNonNegativeInt(p.baixas, 0),
        visitantes: Utils.parseNonNegativeInt(p.visitantes, 0),
        licenca_convalescenca: Utils.parseNonNegativeInt(p.licenca_convalescenca, 0),
        restricao: Utils.parseNonNegativeInt(p.restricao, 0),
        estagiarios: Utils.parseNonNegativeInt(p.estagiarios, 0),
        complemento: p.complemento || '',
        complementos: complementos
      };
    }

    return {
      falta: 0,
      folga: 0,
      troca: 0,
      baixas: 0,
      visitantes: 0,
      licenca_convalescenca: 0,
      restricao: 0,
      estagiarios: 0,
      complemento: '',
      complementos: []
    };
  }

  /**
   * Salva a Seção 2 - Material Bélico (Armamentos, Coletes, Munições e Outros)
   */
  function saveMateriaisBelicos(registroId, data) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    // Remove registros anteriores desta seção para o registro_id e regrava os atuais
    Database.deleteWhere('MATERIAIS_BELICOS', { registro_id: registroId });

    const batch = [];

    // 2.1 Armamento
    if (data.armamentos && Array.isArray(data.armamentos)) {
      data.armamentos.forEach(item => {
        if (item.tipo || item.numero_serie || item.modelo) {
          batch.push({
            registro_id: registroId,
            categoria: 'armamento',
            tipo: String(item.tipo || '').trim(),
            modelo_tamanho: String(item.modelo || '').trim(),
            marca_capas: String(item.marca || '').trim(),
            numero_serie: String(item.numero_serie || '').trim(),
            quantidade: 1
          });
        }
      });
    }

    // 2.2 Colete Balístico
    if (data.coletes && Array.isArray(data.coletes)) {
      data.coletes.forEach(item => {
        if (item.tamanho || item.numero_serie || item.quantidade) {
          batch.push({
            registro_id: registroId,
            categoria: 'colete',
            tipo: 'Colete Balístico',
            modelo_tamanho: String(item.tamanho || '').trim(),
            marca_capas: String(item.capas || '').trim(),
            numero_serie: String(item.numero_serie || '').trim(),
            quantidade: Utils.parseNonNegativeInt(item.quantidade, 1)
          });
        }
      });
    }

    // 2.3 Munição
    if (data.municoes && Array.isArray(data.municoes)) {
      data.municoes.forEach(item => {
        if (item.tipo || item.quantidade) {
          batch.push({
            registro_id: registroId,
            categoria: 'municao',
            tipo: String(item.tipo || '').trim(),
            modelo_tamanho: '',
            marca_capas: '',
            numero_serie: '',
            quantidade: Utils.parseNonNegativeInt(item.quantidade, 0)
          });
        }
      });
    }

    // Outros materiais bélicos
    if (data.outros_materiais) {
      batch.push({
        registro_id: registroId,
        categoria: 'outros',
        tipo: 'Outros Materiais Bélicos',
        modelo_tamanho: '',
        marca_capas: '',
        numero_serie: '',
        quantidade: 1,
        atualizado_em: Utils.nowTimestamp(),
        observacoes: String(data.outros_materiais).trim()
      });
    }

    if (batch.length > 0) {
      Database.insertBatch('MATERIAIS_BELICOS', batch);
    }

    return getMateriaisBelicos(registroId);
  }

  /**
   * Obtém a Seção 2 - Material Bélico
   */
  function getMateriaisBelicos(registroId) {
    const items = Database.find('MATERIAIS_BELICOS', m => String(m.registro_id) === String(registroId));
    const result = {
      armamentos: [],
      coletes: [],
      municoes: [],
      outros_materiais: ''
    };

    items.forEach(item => {
      if (item.categoria === 'armamento') {
        result.armamentos.push({
          tipo: item.tipo,
          modelo: item.modelo_tamanho,
          marca: item.marca_capas,
          numero_serie: item.numero_serie
        });
      } else if (item.categoria === 'colete') {
        result.coletes.push({
          tamanho: item.modelo_tamanho,
          quantidade: Utils.parseNonNegativeInt(item.quantidade, 1),
          capas: item.marca_capas,
          numero_serie: item.numero_serie
        });
      } else if (item.categoria === 'municao') {
        result.municoes.push({
          tipo: item.tipo,
          quantidade: Utils.parseNonNegativeInt(item.quantidade, 0)
        });
      } else if (item.categoria === 'outros') {
        result.outros_materiais = item.marca_capas || item.modelo_tamanho || item.tipo || '';
      }
    });

    return result;
  }

  /**
   * Salva a Seção 3 - Novidade de Material/Equipamentos
   */
  function saveNovidadesMateriais(registroId, data) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    const cleanData = {
      registro_id: registroId,
      descricao: String(data.descricao || '').trim(),
      atualizado_em: Utils.nowTimestamp()
    };

    const existing = Database.find('NOVIDADES_MATERIAIS', m => String(m.registro_id) === String(registroId));
    if (existing && existing.length > 0) {
      Database.update('NOVIDADES_MATERIAIS', existing[0].id, cleanData);
    } else {
      cleanData.id = Utils.generateId('mat');
      Database.insert('NOVIDADES_MATERIAIS', cleanData);
    }
    return cleanData;
  }

  function getNovidadesMateriais(registroId) {
    const list = Database.find('NOVIDADES_MATERIAIS', m => String(m.registro_id) === String(registroId));
    return list && list.length > 0 ? (list[0].descricao || '') : '';
  }

  const DEFAULT_CATALOGO_MATERIAIS = [
    {
      categoria: 'armamento',
      tipo: 'Pistola',
      modelo_tamanho: 'PT 24/7 PRO Cal .40',
      marca_capas: 'Taurus',
      numero_serie: 'SAY15201',
      quantidade_padrao: 1
    },
    {
      categoria: 'armamento',
      tipo: 'Pistola',
      modelo_tamanho: 'TS9 Cal 9mm',
      marca_capas: 'Taurus',
      numero_serie: 'TBE15202',
      quantidade_padrao: 1
    },
    {
      categoria: 'colete',
      tipo: 'Colete Balístico Nível II',
      modelo_tamanho: 'Tamanho G',
      marca_capas: 'Inbrapel / Capa Azul',
      numero_serie: 'COL-15201',
      quantidade_padrao: 1
    },
    {
      categoria: 'colete',
      tipo: 'Colete Balístico Nível II',
      modelo_tamanho: 'Tamanho M',
      marca_capas: 'Inbrapel / Capa Azul',
      numero_serie: 'COL-15202',
      quantidade_padrao: 1
    },
    {
      categoria: 'municao',
      tipo: 'Munição .40 S&W Gold Dot',
      modelo_tamanho: 'Calibre .40',
      marca_capas: 'CBC',
      numero_serie: '',
      quantidade_padrao: 30
    },
    {
      categoria: 'municao',
      tipo: 'Munição 9x19mm Luger',
      modelo_tamanho: 'Calibre 9mm',
      marca_capas: 'CBC',
      numero_serie: '',
      quantidade_padrao: 34
    }
  ];

  function ensureDefaultCatalogo() {
    const existing = Database.getAll('CATALOGO_MATERIAIS');
    if (existing.length === 0) {
      const now = Utils.nowTimestamp();
      const batch = DEFAULT_CATALOGO_MATERIAIS.map(item => ({
        id: Utils.generateId('cat'),
        categoria: item.categoria,
        tipo: item.tipo,
        modelo_tamanho: item.modelo_tamanho,
        marca_capas: item.marca_capas,
        numero_serie: item.numero_serie,
        quantidade_padrao: item.quantidade_padrao,
        criado_em: now,
        atualizado_em: now
      }));
      Database.insertBatch('CATALOGO_MATERIAIS', batch);
    }
  }

  function getCatalogoMateriais() {
    ensureDefaultCatalogo();
    return Database.getAll('CATALOGO_MATERIAIS');
  }

  function saveItemCatalogo(itemData) {
    if (!itemData.categoria) throw new Error('Categoria é obrigatória (armamento, colete, municao, outros).');
    const now = Utils.nowTimestamp();
    if (itemData.id) {
      const existing = Database.getById('CATALOGO_MATERIAIS', itemData.id);
      if (existing) {
        return Database.update('CATALOGO_MATERIAIS', itemData.id, {
          categoria: itemData.categoria,
          tipo: itemData.tipo || existing.tipo,
          modelo_tamanho: itemData.modelo_tamanho || existing.modelo_tamanho,
          marca_capas: itemData.marca_capas || existing.marca_capas,
          numero_serie: itemData.numero_serie !== undefined ? itemData.numero_serie : existing.numero_serie,
          quantidade_padrao: itemData.quantidade_padrao !== undefined ? itemData.quantidade_padrao : existing.quantidade_padrao,
          atualizado_em: now
        });
      }
    }
    const newItem = {
      id: Utils.generateId('cat'),
      categoria: itemData.categoria,
      tipo: itemData.tipo || '',
      modelo_tamanho: itemData.modelo_tamanho || '',
      marca_capas: itemData.marca_capas || '',
      numero_serie: itemData.numero_serie || '',
      quantidade_padrao: Utils.parseNonNegativeInt(itemData.quantidade_padrao, 1),
      criado_em: now,
      atualizado_em: now
    };
    Database.insert('CATALOGO_MATERIAIS', newItem);
    return newItem;
  }

  function deleteItemCatalogo(id) {
    Database.deleteWhere('CATALOGO_MATERIAIS', { id: id });
    return { success: true };
  }

  /**
   * Obtém a lista de viaturas da frota da unidade (integrado à planilha de controle de frota)
   */
  function listViaturasFrota(sgb, pbNome) {
    try {
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.openById) {
        const ss = SpreadsheetApp.openById(Config.SPREADSHEET_FROTA_ID);
        const sheet = ss.getSheetByName(Config.TAB_FROTA_VIATURAS);
        if (sheet) {
          const data = sheet.getDataRange().getValues();
          if (data.length > 1) {
            const headers = data[0].map(h => String(h || '').trim().toUpperCase());
            const idxPrefixo = headers.indexOf('PREFIXO');
            const idxEstacao = headers.findIndex(h => h.includes('PERTENCE') || h.includes('ESTAÇÃO') || h.includes('ESTACAO'));
            const idxSgb = headers.indexOf('SGB');
            const idxStatus = headers.indexOf('STATUS');
            const idxKm = headers.indexOf('KM');

            const viaturas = [];
            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              const prefixo = idxPrefixo !== -1 ? String(row[idxPrefixo] || '').trim() : '';
              if (!prefixo) continue;

              const estacao = idxEstacao !== -1 ? String(row[idxEstacao] || '').trim() : '';
              const rowSgb = idxSgb !== -1 ? String(row[idxSgb] || '').trim() : '';
              const status = idxStatus !== -1 ? String(row[idxStatus] || 'Operando').trim() : 'Operando';
              const km = idxKm !== -1 ? String(row[idxKm] || '').trim() : '';

              viaturas.push({
                prefixo: prefixo,
                estacao: estacao,
                sgb: rowSgb,
                status: status,
                km: km
              });
            }
            if (viaturas.length > 0) return viaturas;
          }
        }
      }
    } catch (e) {}

    // Frota operacional padrão da unidade (2º SGB)
    return [
      { prefixo: 'AB-15201', estacao: 'SÃO ROQUE', sgb: '2º SGB', status: 'Operando', km: '42500' },
      { prefixo: 'UR-15201', estacao: 'SÃO ROQUE', sgb: '2º SGB', status: 'Operando', km: '38100' },
      { prefixo: 'ABS-15203', estacao: 'SÃO ROQUE', sgb: '2º SGB', status: 'Operando', km: '29400' },
      { prefixo: 'VO-15201', estacao: 'SÃO ROQUE', sgb: '2º SGB', status: 'Reserva', km: '61000' },
      { prefixo: 'USA-15202', estacao: 'SÃO ROQUE', sgb: '2º SGB', status: 'Operando', km: '15800' },
      { prefixo: 'AB-15202', estacao: 'ITU', sgb: '2º SGB', status: 'Operando', km: '51200' },
      { prefixo: 'UR-15202', estacao: 'ITU', sgb: '2º SGB', status: 'Operando', km: '46300' }
    ];
  }

  /**
   * Salva a Seção 4 - Situação de Viaturas com Componentes/Guarnição
   */
  function saveViaturas(registroId, viaturasList) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    Database.deleteWhere('VIATURAS_REGISTRO', { registro_id: registroId });

    const batch = [];
    if (Array.isArray(viaturasList)) {
      viaturasList.forEach(v => {
        if (v.prefixo) {
          const auxList = Array.isArray(v.auxiliares) ? v.auxiliares : [];
          batch.push({
            id: Utils.generateId('vt'),
            registro_id: registroId,
            prefixo: String(v.prefixo).trim().toUpperCase(),
            situacao: String(v.situacao || 'Operando').trim(),
            observacoes: String(v.observacoes || '').trim(),
            comandante_re: String(v.comandante_re || (v.comandante && v.comandante.re) || '').trim(),
            comandante_nome: String(v.comandante_nome || (v.comandante && (v.comandante.display || v.comandante.nome)) || '').trim(),
            motorista_re: String(v.motorista_re || (v.motorista && v.motorista.re) || '').trim(),
            motorista_nome: String(v.motorista_nome || (v.motorista && (v.motorista.display || v.motorista.nome)) || '').trim(),
            auxiliares_json: JSON.stringify(auxList),
            atualizado_em: Utils.nowTimestamp()
          });
        }
      });
    }

    if (batch.length > 0) {
      Database.insertBatch('VIATURAS_REGISTRO', batch);
    }

    return getViaturas(registroId);
  }

  function getViaturas(registroId) {
    const items = Database.find('VIATURAS_REGISTRO', v => String(v.registro_id) === String(registroId));
    const totais = {
      operando: 0,
      baixada: 0,
      reserva: 0,
      acidentada: 0
    };

    const list = items.map(v => {
      const sit = String(v.situacao || '').toLowerCase();
      if (sit === 'operando') totais.operando++;
      else if (sit === 'baixada') totais.baixada++;
      else if (sit === 'reserva') totais.reserva++;
      else if (sit === 'acidentada') totais.acidentada++;

      let aux = [];
      try {
        if (v.auxiliares_json) aux = JSON.parse(v.auxiliares_json);
      } catch (e) {}

      return {
        id: v.id,
        prefixo: v.prefixo,
        situacao: v.situacao,
        observacoes: v.observacoes || '',
        comandante_re: v.comandante_re || '',
        comandante_nome: v.comandante_nome || '',
        motorista_re: v.motorista_re || '',
        motorista_nome: v.motorista_nome || '',
        auxiliares: aux
      };
    });

    return {
      viaturas: list,
      totais: totais
    };
  }

  /**
   * Salva a Seção 5 - Ordem do Dia
   */
  function saveOrdemDia(registroId, texto) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    const cleanData = {
      registro_id: registroId,
      texto: String(texto || '').trim(),
      atualizado_em: Utils.nowTimestamp()
    };

    const existing = Database.find('ORDENS_DIA', o => String(o.registro_id) === String(registroId));
    if (existing && existing.length > 0) {
      Database.update('ORDENS_DIA', existing[0].id, cleanData);
    } else {
      cleanData.id = Utils.generateId('ord');
      Database.insert('ORDENS_DIA', cleanData);
    }
    return cleanData;
  }

  function getOrdemDia(registroId) {
    const list = Database.find('ORDENS_DIA', o => String(o.registro_id) === String(registroId));
    return list && list.length > 0 ? (list[0].texto || '') : '';
  }

  /**
   * Salva a Seção 6 - Ordens Recebidas (6.1 Verbais, 6.2 Escritas)
   */
  function saveOrdensRecebidas(registroId, data) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    Database.deleteWhere('ORDENS_RECEBIDAS', { registro_id: registroId });

    const batch = [];
    if (data.verbais) {
      batch.push({
        registro_id: registroId,
        tipo: 'verbais',
        texto: String(data.verbais).trim()
      });
    }
    if (data.escritas) {
      batch.push({
        registro_id: registroId,
        tipo: 'escritas',
        texto: String(data.escritas).trim()
      });
    }

    if (batch.length > 0) {
      Database.insertBatch('ORDENS_RECEBIDAS', batch);
    }

    return getOrdensRecebidas(registroId);
  }

  function getOrdensRecebidas(registroId) {
    const items = Database.find('ORDENS_RECEBIDAS', o => String(o.registro_id) === String(registroId));
    const result = {
      verbais: '',
      escritas: ''
    };
    items.forEach(item => {
      if (item.tipo === 'verbais') result.verbais = item.texto || '';
      else if (item.tipo === 'escritas') result.escritas = item.texto || '';
    });
    return result;
  }

  /**
   * Salva Treinamentos e Instruções (Seções 7, 8 e 9)
   */
  function saveTreinamentos(registroId, data) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    Database.deleteWhere('ATIVIDADES_TREINAMENTO', { registro_id: registroId });

    const batch = [];

    // Seção 7: Armar Geral
    if (data.armar_geral) {
      const ag = data.armar_geral;
      batch.push({
        registro_id: registroId,
        secao_tipo: 'armar_geral',
        treinamento_assunto: String(ag.treinamento_executado || '').trim(),
        normas_literatura: String(ag.pops_normas || '').trim(),
        instrutor_re: String(ag.instrutor_re || '').trim(),
        instrutor_nome: String(ag.instrutor_nome || '').trim(),
        participantes_res: Array.isArray(ag.participantes_res) ? ag.participantes_res.join('; ') : String(ag.participantes_res || ''),
        participantes_nomes: Array.isArray(ag.participantes_nomes) ? ag.participantes_nomes.join('; ') : String(ag.participantes_nomes || ''),
        materiais_utilizados: String(ag.materiais_utilizados || '').trim(),
        observacoes: String(ag.observacoes || '').trim()
      });
    }

    // Seção 8: Instrução
    if (data.instrucao) {
      const ins = data.instrucao;
      batch.push({
        registro_id: registroId,
        secao_tipo: 'instrucao',
        treinamento_assunto: String(ins.assunto || '').trim(),
        normas_literatura: String(ins.literatura_tecnica || '').trim(),
        instrutor_re: String(ins.instrutor_re || '').trim(),
        instrutor_nome: String(ins.instrutor_nome || '').trim(),
        participantes_res: Array.isArray(ins.participantes_res) ? ins.participantes_res.join('; ') : String(ins.participantes_res || ''),
        participantes_nomes: Array.isArray(ins.participantes_nomes) ? ins.participantes_nomes.join('; ') : String(ins.participantes_nomes || ''),
        materiais_utilizados: '',
        observacoes: String(ins.observacoes || '').trim()
      });
    }

    // Seção 9: Treinamento Físico
    if (data.treinamento_fisico) {
      const tf = data.treinamento_fisico;
      batch.push({
        registro_id: registroId,
        secao_tipo: 'treinamento_fisico',
        treinamento_assunto: String(tf.atividades_realizadas || '').trim(),
        normas_literatura: '',
        instrutor_re: String(tf.instrutor_re || '').trim(),
        instrutor_nome: String(tf.instrutor_nome || '').trim(),
        participantes_res: '',
        participantes_nomes: '',
        materiais_utilizados: '',
        observacoes: String(tf.observacoes || '').trim()
      });
    }

    if (batch.length > 0) {
      Database.insertBatch('ATIVIDADES_TREINAMENTO', batch);
    }

    return getTreinamentos(registroId);
  }

  function getTreinamentos(registroId) {
    const items = Database.find('ATIVIDADES_TREINAMENTO', t => String(t.registro_id) === String(registroId));
    const result = {
      armar_geral: {
        treinamento_executado: '',
        pops_normas: '',
        instrutor_re: '',
        instrutor_nome: '',
        participantes_res: '',
        participantes_nomes: '',
        materiais_utilizados: '',
        observacoes: ''
      },
      instrucao: {
        assunto: '',
        instrutor_re: '',
        instrutor_nome: '',
        participantes_res: '',
        participantes_nomes: '',
        literatura_tecnica: '',
        observacoes: ''
      },
      treinamento_fisico: {
        atividades_realizadas: '',
        instrutor_re: '',
        instrutor_nome: '',
        observacoes: ''
      }
    };

    items.forEach(item => {
      if (item.secao_tipo === 'armar_geral') {
        result.armar_geral = {
          treinamento_executado: item.treinamento_assunto || '',
          pops_normas: item.normas_literatura || '',
          instrutor_re: item.instrutor_re || '',
          instrutor_nome: item.instrutor_nome || '',
          participantes_res: item.participantes_res || '',
          participantes_nomes: item.participantes_nomes || '',
          materiais_utilizados: item.materiais_utilizados || '',
          observacoes: item.observacoes || ''
        };
      } else if (item.secao_tipo === 'instrucao') {
        result.instrucao = {
          assunto: item.treinamento_assunto || '',
          instrutor_re: item.instrutor_re || '',
          instrutor_nome: item.instrutor_nome || '',
          participantes_res: item.participantes_res || '',
          participantes_nomes: item.participantes_nomes || '',
          literatura_tecnica: item.normas_literatura || '',
          observacoes: item.observacoes || ''
        };
      } else if (item.secao_tipo === 'treinamento_fisico') {
        result.treinamento_fisico = {
          atividades_realizadas: item.treinamento_assunto || '',
          instrutor_re: item.instrutor_re || '',
          instrutor_nome: item.instrutor_nome || '',
          observacoes: item.observacoes || ''
        };
      }
    });

    return result;
  }

  /**
   * Salva a Seção 10 - Manutenção do Quartel
   */
  function saveManutencao(registroId, data) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    const cleanData = {
      registro_id: registroId,
      limpeza: String(data.limpeza || '').trim(),
      melhorias: String(data.melhorias || '').trim(),
      medidor_energia: String(data.medidor_energia || '').trim(),
      medidor_energia_unidade: String(data.medidor_energia_unidade || 'kWh').trim(),
      hidrometro: String(data.hidrometro || '').trim(),
      hidrometro_unidade: String(data.hidrometro_unidade || 'm³/h').trim(),
      atualizado_em: Utils.nowTimestamp()
    };

    const existing = Database.find('MANUTENCAO_QUARTEL', m => String(m.registro_id) === String(registroId));
    if (existing && existing.length > 0) {
      Database.update('MANUTENCAO_QUARTEL', existing[0].id, cleanData);
    } else {
      cleanData.id = Utils.generateId('man');
      Database.insert('MANUTENCAO_QUARTEL', cleanData);
    }
    return cleanData;
  }

  function getManutencao(registroId) {
    const list = Database.find('MANUTENCAO_QUARTEL', m => String(m.registro_id) === String(registroId));
    if (list && list.length > 0) {
      const m = list[0];
      return {
        limpeza: m.limpeza || '',
        melhorias: m.melhorias || '',
        medidor_energia: m.medidor_energia || '',
        medidor_energia_unidade: m.medidor_energia_unidade || 'kWh',
        hidrometro: m.hidrometro || '',
        hidrometro_unidade: m.hidrometro_unidade || 'm³/h'
      };
    }
    return {
      limpeza: '',
      melhorias: '',
      medidor_energia: '',
      medidor_energia_unidade: 'kWh',
      hidrometro: '',
      hidrometro_unidade: 'm³/h'
    };
  }

  /**
   * Salva a Seção 11 - Comentários de Ocorrências de Vulto Atendidas
   */
  function saveOcorrencias(registroId, texto) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    const cleanData = {
      registro_id: registroId,
      texto: String(texto || '').trim(),
      atualizado_em: Utils.nowTimestamp()
    };

    const existing = Database.find('COMENTARIOS_OCORRENCIAS', o => String(o.registro_id) === String(registroId));
    if (existing && existing.length > 0) {
      Database.update('COMENTARIOS_OCORRENCIAS', existing[0].id, cleanData);
    } else {
      cleanData.id = Utils.generateId('oco');
      Database.insert('COMENTARIOS_OCORRENCIAS', cleanData);
    }
    return cleanData;
  }

  function getOcorrencias(registroId) {
    const list = Database.find('COMENTARIOS_OCORRENCIAS', o => String(o.registro_id) === String(registroId));
    return list && list.length > 0 ? (list[0].texto || '') : '';
  }

  /**
   * Salva a Seção 12 - Rondas Efetuadas
   */
  function saveRondas(registroId, rondasList) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');

    Database.deleteWhere('RONDAS', { registro_id: registroId });

    const batch = [];
    if (Array.isArray(rondasList)) {
      rondasList.forEach((r, idx) => {
        if (r.funcao || r.posto || r.responsavel_nome || r.responsavel_re) {
          batch.push({
            registro_id: registroId,
            ordem: idx + 1,
            funcao: String(r.funcao || '').trim(),
            posto: String(r.posto || '').trim(),
            data_hora: String(r.data_hora || '').trim(),
            responsavel_re: String(r.responsavel_re || '').trim(),
            responsavel_nome: String(r.responsavel_nome || '').trim(),
            novidades_sugestoes: String(r.novidades_sugestoes || '').trim(),
            validacao_status: String(r.validacao_status || 'CONFIRMADA').trim(),
            validado_por: String(r.validado_por || r.responsavel_re || '').trim(),
            validado_em: r.validado_em || Utils.nowTimestamp()
          });
        }
      });
    }

    if (batch.length > 0) {
      Database.insertBatch('RONDAS', batch);
    }

    return getRondas(registroId);
  }

  function getRondas(registroId) {
    const items = Database.find('RONDAS', r => String(r.registro_id) === String(registroId));
    items.sort((a, b) => (parseInt(a.ordem, 10) || 0) - (parseInt(b.ordem, 10) || 0));
    return items.map(r => ({
      ordem: r.ordem,
      funcao: r.funcao || '',
      posto: r.posto || '',
      data_hora: r.data_hora || '',
      responsavel_re: r.responsavel_re || '',
      responsavel_nome: r.responsavel_nome || '',
      novidades_sugestoes: r.novidades_sugestoes || '',
      validacao_status: r.validacao_status || '',
      validado_em: r.validado_em || ''
    }));
  }

  return {
    savePessoal: savePessoal,
    getPessoal: getPessoal,
    saveMateriaisBelicos: saveMateriaisBelicos,
    getMateriaisBelicos: getMateriaisBelicos,
    saveNovidadesMateriais: saveNovidadesMateriais,
    getNovidadesMateriais: getNovidadesMateriais,
    saveViaturas: saveViaturas,
    getViaturas: getViaturas,
    listViaturasFrota: listViaturasFrota,
    ensureDefaultCatalogo: ensureDefaultCatalogo,
    getCatalogoMateriais: getCatalogoMateriais,
    saveItemCatalogo: saveItemCatalogo,
    deleteItemCatalogo: deleteItemCatalogo,
    saveOrdemDia: saveOrdemDia,
    getOrdemDia: getOrdemDia,
    saveOrdensRecebidas: saveOrdensRecebidas,
    getOrdensRecebidas: getOrdensRecebidas,
    saveTreinamentos: saveTreinamentos,
    getTreinamentos: getTreinamentos,
    saveManutencao: saveManutencao,
    getManutencao: getManutencao,
    saveOcorrencias: saveOcorrencias,
    getOcorrencias: getOcorrencias,
    saveRondas: saveRondas,
    getRondas: getRondas
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecoesOperacionais;
}
