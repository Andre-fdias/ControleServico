/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Conferencias.js - Conferência e assinaturas eletrônicas das 3 autoridades responsáveis
 * (Cmt que sai, Cmt que entra e Cmt do PB)
 */

var Conferencias = (function() {
  /**
   * Obtém as conferências de um registro
   */
  function getConferencias(registroId) {
    const list = Database.find('CONFERENCIAS', c => String(c.registro_id) === String(registroId));
    const result = {
      cmt_sai: null,
      cmt_entra: null,
      cmt_pb: null
    };

    list.forEach(c => {
      const papelKey = String(c.papel).toLowerCase();
      if (papelKey.includes('sai') || papelKey === 'cmt_sai') {
        result.cmt_sai = c;
      } else if (papelKey.includes('entra') || papelKey === 'cmt_entra') {
        result.cmt_entra = c;
      } else if (papelKey.includes('pb') || papelKey === 'cmt_pb') {
        result.cmt_pb = c;
      }
    });

    return result;
  }

  /**
   * Realiza a validação / conferência oficial por uma autoridade
   */
  function validarConferencia(registroId, papelKey, sessionUser, observacoes = '', militarReOverride = null) {
    if (!registroId) throw new Error('ID do registro é obrigatório.');
    if (!sessionUser) throw new Error('Usuário não autenticado.');

    const registro = Database.getById('REGISTROS_ATIVIDADES', registroId);
    if (!registro) throw new Error('Registro de Atividades não encontrado.');

    if (registro.status === Config.STATUS_REGISTRO.FINALIZADO) {
      throw new Error('Não é possível alterar a conferência de um registro já finalizado.');
    }
    if (registro.status === Config.STATUS_REGISTRO.CANCELADO) {
      throw new Error('Registro cancelado não permite conferência.');
    }

    // Busca os dados cadastrais do militar que está conferindo (com suporte a override de RE para testes)
    const reAlvo = militarReOverride ? Utils.normalizeRE(militarReOverride) : sessionUser.re;
    const militar = Militares.findByRE(reAlvo);
    const graduacao = militar ? militar.graduacao : (sessionUser.perfil === Config.ROLES.ADMIN ? 'ADMIN' : 'MILITAR');
    const nomeCompleto = militar ? militar.nome_completo : (militarReOverride ? `Militar RE ${reAlvo}` : sessionUser.nome_completo);

    // Remove conferência anterior para o mesmo papel neste registro
    Database.deleteWhere('CONFERENCIAS', {
      registro_id: registroId,
      papel: papelKey
    });

    const now = Utils.nowTimestamp();
    const confRecord = {
      id: Utils.generateId('cnf'),
      registro_id: registroId,
      papel: papelKey,
      autoridade_re: reAlvo,
      autoridade_graduacao: graduacao,
      autoridade_nome: nomeCompleto,
      status: 'CONFERIDO',
      data_hora: now,
      ip_hash: Utils.sha256(reAlvo + now).slice(0, 16),
      observacoes: String(observacoes || '').trim()
    };

    Database.insert('CONFERENCIAS', confRecord);

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'CONFERENCIA_ASSINATURA',
      entidade: 'CONFERENCIAS',
      registro_id: registroId,
      resultado: 'SUCESSO',
      detalhes: `Validação assinada como ${papelKey} por ${graduacao} ${sessionUser.re}`
    });

    // Verifica se todas as 3 autoridades já conferiram
    const allConfs = getConferencias(registroId);
    let novoStatus = registro.status;

    if (allConfs.cmt_sai && allConfs.cmt_entra && allConfs.cmt_pb) {
      novoStatus = Config.STATUS_REGISTRO.CONFERIDO;
    } else {
      novoStatus = Config.STATUS_REGISTRO.AGUARDANDO_CONFERENCIA;
    }

    if (novoStatus !== registro.status) {
      Database.update('REGISTROS_ATIVIDADES', registroId, {
        status: novoStatus,
        atualizado_em: now
      });
    }

    return {
      conferencia: confRecord,
      todas: allConfs,
      status_registro: novoStatus
    };
  }

  return {
    getConferencias: getConferencias,
    validarConferencia: validarConferencia
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Conferencias;
}
