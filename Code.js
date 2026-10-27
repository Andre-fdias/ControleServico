/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Code.js - Ponto de entrada do Google Apps Script (Web App) e roteador RPC seguro
 */

/**
 * Ponto de entrada do Web App
 */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.unblock) {
      let count = 0;
      try {
        const users = Database.getAll('USUARIOS');
        users.forEach(u => {
          if (u.bloqueado_ate || parseInt(u.tentativas_falhas, 10) > 0) {
            Database.update('USUARIOS', u.id, {
              tentativas_falhas: 0,
              bloqueado_ate: ''
            });
            count++;
          }
        });
      } catch (err) {}
      return ContentService.createTextOutput(JSON.stringify({ success: true, unblocked: count }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (e && e.parameter && e.parameter.checkRe) {
      const re = Utils.normalizeRE(e.parameter.checkRe);
      let user = null;
      let militar = null;
      let sampleMilitares = [];
      let totalMilitares = 0;
      let totalUsuarios = 0;
      try {
        const allUsers = Database.getAll('USUARIOS');
        totalUsuarios = allUsers.length;
        user = allUsers.find(u => Utils.normalizeRE(u.re) === re) || null;

        const allMils = Database.getAll('MILITARES');
        totalMilitares = allMils.length;
        militar = allMils.find(m => Utils.normalizeRE(m.re) === re) || null;
        sampleMilitares = allMils.slice(0, 10).map(m => ({ re: m.re, nome: m.nome_completo || m.nome_guerra, ativo: m.ativo }));
      } catch (err) {}

      return ContentService.createTextOutput(JSON.stringify({
        searchedRe: re,
        totalUsuarios,
        totalMilitares,
        userFound: user ? { re: user.re, ativo: user.ativo, forcar_troca_senha: user.forcar_troca_senha, salt: !!user.salt } : null,
        militarFound: militar,
        sampleMilitares
      }, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

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
 * Gatilho oficial de abertura da Planilha Google
 * Cria o menu personalizado '🚒 Livro de Registro' na barra de ferramentas
 */
function onOpen(e) {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🚒 Livro de Registro')
      .addItem('⚙️ 1. Inicializar Banco de Dados (Criar Todas as Abas)', 'menuInicializarBancoDeDados')
      .addItem('🚀 2. Abrir Sistema Web (Livro de Registro)', 'menuAbrirSistemaWeb')
      .addSeparator()
      .addItem('🔄 3. Sincronizar Efetivo (SisFolgas)', 'menuSincronizarEfetivo')
      .addToUi();
  } catch (err) {}
}

function menuInicializarBancoDeDados() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Inicialização do Banco de Dados',
    'Deseja criar e configurar todas as tabelas, abas, colunas e dados iniciais (efetivo militar, catálogo de materiais e usuário admin padrão)?\n\nOperação segura e idempotente.',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  try {
    const res = apiBootstrapSystem();
    ui.alert(
      'Sucesso!',
      `Banco de dados inicializado com sucesso!\n\n` +
      `• Abas verificadas/criadas: ${res.schema.createdSheets.length}\n` +
      `• Militares base cadastrados: ${res.seeds.militaresCadastrados}\n` +
      `• Postos de Bombeiros cadastrados: ${res.seeds.postosCadastrados}\n` +
      `• Usuário padrão: admin (senha provisória: admin)\n\n` +
      `Use o menu "🚀 2. Abrir Sistema Web" para iniciar o serviço.`,
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Erro', 'Falha ao inicializar banco de dados: ' + err.message, ui.ButtonSet.OK);
  }
}

function menuAbrirSistemaWeb() {
  const ui = SpreadsheetApp.getUi();
  let url = '';
  try {
    url = ScriptApp.getService().getUrl();
  } catch (e) {}
  if (!url) {
    url = 'https://script.google.com/macros/s/AKfycbyJ2bT7f4fx7h-EW0dnwrD82ilcVLHkWZLCNvKu1eeFSLaLzSUCImExSTIHk2UP4Zzb/exec';
  }

  const html = HtmlService.createHtmlOutput(
    `<div style="font-family: Arial, sans-serif; text-align: center; padding: 1.5rem; color: #1e293b;">
      <h3 style="color: #ef4444; margin-bottom: 0.5rem; font-size: 1.15rem;">Livro de Registro de Atividades</h3>
      <p style="color: #64748b; font-size: 13px; margin-bottom: 1.5rem;">Clique no botão abaixo para abrir o sistema em uma nova aba:</p>
      <a href="${url}" target="_blank" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
        🚀 Abrir Livro de Registro
      </a>
      <div style="margin-top: 1.5rem; font-size: 11px; color: #94a3b8; word-break: break-all;">
        Link direto: <a href="${url}" target="_blank" style="color: #2563eb;">${url}</a>
      </div>
    </div>`
  ).setWidth(460).setHeight(220);
  ui.showModalDialog(html, 'Livro de Registro de Atividades — CBM PMESP');
}

function menuSincronizarEfetivo() {
  const ui = SpreadsheetApp.getUi();
  try {
    const res = Militares.syncEfetivoFromSisFolgas();
    ui.alert(
      'Sincronização com SisFolgas',
      `Sincronização concluída com sucesso!\n\n` +
      `• Militares importados/atualizados: ${res.importados}\n` +
      `• Efetivo total: ${res.total}`,
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Erro', 'Falha ao sincronizar com SisFolgas: ' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * Procedimento seguro de inicialização idempotente do sistema (Bootstrap)
 */
function apiBootstrapSystem() {
  const schemaReport = Database.initializeSchema();
  Auth.ensureDefaultAdmin();
  Unidades.ensureDefaultGrupamentos();
  Unidades.ensureDefaultPostos();
  SecoesOperacionais.ensureDefaultCatalogo();
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
    const res = Auth.login(username, password);
    return JSON.stringify(res);
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message || String(e) });
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
    return JSON.stringify({
      success: true,
      user: sessionUser,
      grupamentos: Unidades.listGrupamentos(),
      sgbs: Unidades.listSGBs(),
      postos: Unidades.listPostos(),
      graduacoes: Config.GRADUACOES,
      postosOficiais: Config.POSTOS_OFICIAIS,
      graduacoesPracas: Config.GRADUACOES_PRACAS,
      categoriasPessoal: Config.CATEGORIAS_PESSOAL,
      catalogoMateriais: SecoesOperacionais.getCatalogoMateriais(),
      viaturasFrota: SecoesOperacionais.listViaturasFrota(),
      prontidoes: Config.PRONTIDOES,
      defaultHoraInicio: Config.DEFAULT_HORA_INICIO
    });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message || String(e) });
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

// ============================================================================
// NOVAS ROTAS OPERACIONAIS: FROTA, CATÁLOGO, CADASTRO RÁPIDO E SINCRONIZAÇÃO
// ============================================================================

function apiListViaturasFrota(sgb, pbNome, token) {
  try {
    if (token) _requireSession(token);
    return { success: true, viaturas: SecoesOperacionais.listViaturasFrota(sgb, pbNome) };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiGetCatalogoMateriais(token) {
  try {
    if (token) _requireSession(token);
    return { success: true, catalogo: SecoesOperacionais.getCatalogoMateriais() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiSaveItemCatalogo(item, token) {
  try {
    _requireSession(token);
    const saved = SecoesOperacionais.saveItemCatalogo(item);
    return { success: true, item: saved };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiDeleteItemCatalogo(id, token) {
  try {
    _requireSession(token);
    SecoesOperacionais.deleteItemCatalogo(id);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiQuickRegisterMilitar(data, token) {
  try {
    _requireSession(token);
    const created = Militares.quickRegisterMilitar(data);
    return { success: true, militar: created };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function apiSyncEfetivoSisFolgas(token) {
  try {
    const sessionUser = _requireSession(token);
    Authorization.requirePermission(sessionUser, 'GERENCIAR_MILITARES');
    const result = Militares.syncEfetivoFromSisFolgas();
    return result;
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
    apiQuickRegisterMilitar: apiQuickRegisterMilitar,
    apiSyncEfetivoSisFolgas: apiSyncEfetivoSisFolgas,
    apiListViaturasFrota: apiListViaturasFrota,
    apiGetCatalogoMateriais: apiGetCatalogoMateriais,
    apiSaveItemCatalogo: apiSaveItemCatalogo,
    apiDeleteItemCatalogo: apiDeleteItemCatalogo,
    apiListUsuarios: apiListUsuarios,
    apiResetPassword: apiResetPassword,
    apiUnlockUser: apiUnlockUser,
    apiListPostos: apiListPostos,
    apiSavePosto: apiSavePosto,
    apiGetAuditLogs: apiGetAuditLogs,
    apiGetFullBackup: apiGetFullBackup
  };
}
