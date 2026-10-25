/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Code.js - Ponto de entrada do Google Apps Script (Web App) e roteador RPC seguro
 */

/**
 * Ponto de entrada do Web App
 */
function doGet(e) {
  try {
    const template = HtmlService.createTemplateFromFile('Index');
    return template.evaluate()
      .setTitle('Livro de Registro de Atividades — Corpo de Bombeiros PMESP')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>Erro ao carregar o sistema: ' + err.message + '</h3>');
  }
}

/**
 * Utilitário de inclusão de arquivos HTML parciais no Apps Script
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Procedimento seguro de inicialização idempotente do sistema (Bootstrap)
 */
function apiBootstrapSystem() {
  const schemaReport = Database.initializeSchema();
  Auth.ensureDefaultAdmin();
  Unidades.ensureDefaultGrupamentos();
  Unidades.ensureDefaultPostos();
  const seedReport = SeedData.populateSeedData();

  return {
    success: true,
    message: 'Sistema inicializado com sucesso.',
    schema: schemaReport,
    seeds: seedReport
  };
}

/**
 * Validação de sessão auxiliar para APIs protegidas
 */
function _requireSession(token) {
  if (!token) {
    throw new Error('Sessão não informada. Faça login para continuar.');
  }
  const sessionUser = Session.validate(token);
  if (!sessionUser) {
    throw new Error('Sessão expirada ou inválida. Por favor, efetue login novamente.');
  }
  return sessionUser;
}

// ============================================================================
// ENDPOINTS DE AUTENTICAÇÃO E CONTA
// ============================================================================

function apiLogin(username, password) {
  try {
    return Auth.login(username, password);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiLogout(token) {
  try {
    Session.destroy(token);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiChangePassword(token, senhaAtual, novaSenha, confirmaNovaSenha) {
  try {
    return Auth.changePassword(token, senhaAtual, novaSenha, confirmaNovaSenha);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================================================================
// DADOS DE INICIALIZAÇÃO DA INTERFACE
// ============================================================================

function apiGetInitialData(token) {
  try {
    const sessionUser = _requireSession(token);
    return {
      success: true,
      user: sessionUser,
      grupamentos: Unidades.listGrupamentos(),
      sgbs: Unidades.listSGBs(),
      postos: Unidades.listPostos(),
      graduacoes: Config.GRADUACOES,
      prontidoes: Config.PRONTIDOES,
      defaultHoraInicio: Config.DEFAULT_HORA_INICIO
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================================================================
// CÁLCULO DE PRONTIDÃO E PERÍODO DE 24H
// ============================================================================

function apiCalculateProntidao(dataInicio, horaInicio) {
  try {
    return {
      success: true,
      data: Prontidao.calcularPeriodoEProntidao(dataInicio, horaInicio)
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================================================================
// PESQUISA E CONSULTA DE MILITARES
// ============================================================================

function apiFindMilitarByRE(re) {
  try {
    const militar = Militares.findByRE(re);
    if (!militar) {
      return { success: false, message: 'Militar não encontrado para o RE informado.' };
    }
    return { success: true, militar: militar };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiSearchMilitares(query) {
  try {
    return {
      success: true,
      results: Militares.search(query, 12)
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================================================================
// REGISTRO DE ATIVIDADES OPERACIONAIS
// ============================================================================

function apiCreateRegistro(payload, token) {
  try {
    const sessionUser = _requireSession(token);
    return RegistroAtividades.create(payload, sessionUser);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiSaveRegistro(registroId, payload, token) {
  try {
    const sessionUser = _requireSession(token);
    const updated = RegistroAtividades.saveComplete(registroId, payload, sessionUser);
    return { success: true, registro: updated };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiGetRegistro(registroId, token) {
  try {
    _requireSession(token);
    const reg = RegistroAtividades.getById(registroId);
    if (!reg) {
      return { success: false, message: 'Registro não encontrado.' };
    }
    return { success: true, registro: reg };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiFinalizarRegistro(registroId, token) {
  try {
    const sessionUser = _requireSession(token);
    const res = RegistroAtividades.finalizar(registroId, sessionUser);
    return { success: true, registro: res };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiCancelarRegistro(registroId, motivo, token) {
  try {
    const sessionUser = _requireSession(token);
    const res = RegistroAtividades.cancelar(registroId, motivo, sessionUser);
    return { success: true, registro: res };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiQueryRegistros(filters, token) {
  try {
    const sessionUser = _requireSession(token);
    const results = RegistroAtividades.queryRegistros(filters, sessionUser);
    return { success: true, data: results };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiValidarConferencia(registroId, papelKey, token, observacoes) {
  try {
    const sessionUser = _requireSession(token);
    const res = Conferencias.validarConferencia(registroId, papelKey, sessionUser, observacoes);
    return { success: true, data: res };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================

function apiGetDashboardStats(filters, token) {
  try {
    _requireSession(token);
    const stats = Reports.getDashboardStats(filters);
    return { success: true, stats: stats };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================================================================
// MÓDULOS ADMINISTRATIVOS
// ============================================================================

function apiListMilitares(token) {
  try {
    _requireSession(token);
    return { success: true, militares: Militares.listAll() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiSaveMilitar(data, token) {
  try {
    const sessionUser = _requireSession(token);
    if (data.id) {
      const updated = Militares.updateMilitar(data.id, data, sessionUser);
      return { success: true, militar: updated };
    } else {
      const created = Militares.createMilitar(data, sessionUser);
      return { success: true, militar: created };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiListUsuarios(token) {
  try {
    const sessionUser = _requireSession(token);
    return { success: true, usuarios: Users.listAll(sessionUser) };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiResetPassword(userId, token) {
  try {
    const sessionUser = _requireSession(token);
    return Users.resetPassword(userId, sessionUser);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiUnlockUser(userId, token) {
  try {
    const sessionUser = _requireSession(token);
    return Users.unlockUser(userId, sessionUser);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiListPostos(filters, token) {
  try {
    _requireSession(token);
    return { success: true, postos: Unidades.listPostos(filters) };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiSavePosto(data, token) {
  try {
    const sessionUser = _requireSession(token);
    if (data.id) {
      const updated = Unidades.updatePosto(data.id, data, sessionUser);
      return { success: true, posto: updated };
    } else {
      const created = Unidades.createPosto(data, sessionUser);
      return { success: true, posto: created };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiGetAuditLogs(filters, token) {
  try {
    const sessionUser = _requireSession(token);
    Authorization.requirePermission(sessionUser, 'CONSULTAR_AUDITORIA');
    return { success: true, logs: Audit.query(filters) };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiGetFullBackup(token) {
  try {
    const sessionUser = _requireSession(token);
    return { success: true, backup: Backup.exportFullBackup(sessionUser) };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    doGet: doGet,
    include: include,
    apiBootstrapSystem: apiBootstrapSystem,
    apiLogin: apiLogin,
    apiLogout: apiLogout,
    apiChangePassword: apiChangePassword,
    apiGetInitialData: apiGetInitialData,
    apiCalculateProntidao: apiCalculateProntidao,
    apiFindMilitarByRE: apiFindMilitarByRE,
    apiSearchMilitares: apiSearchMilitares,
    apiCreateRegistro: apiCreateRegistro,
    apiSaveRegistro: apiSaveRegistro,
    apiGetRegistro: apiGetRegistro,
    apiFinalizarRegistro: apiFinalizarRegistro,
    apiCancelarRegistro: apiCancelarRegistro,
    apiQueryRegistros: apiQueryRegistros,
    apiValidarConferencia: apiValidarConferencia,
    apiGetDashboardStats: apiGetDashboardStats,
    apiListMilitares: apiListMilitares,
    apiSaveMilitar: apiSaveMilitar,
    apiListUsuarios: apiListUsuarios,
    apiResetPassword: apiResetPassword,
    apiUnlockUser: apiUnlockUser,
    apiListPostos: apiListPostos,
    apiSavePosto: apiSavePosto,
    apiGetAuditLogs: apiGetAuditLogs,
    apiGetFullBackup: apiGetFullBackup
  };
}
