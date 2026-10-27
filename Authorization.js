/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Authorization.js - Controle de acesso baseado em papéis (RBAC)
 */

var Authorization = (function() {
  const PERMISSIONS = {
    CONSULTAR_REGISTRO: ['operacional', 'admin'],
    CRIAR_REGISTRO: ['operacional', 'admin'],
    EDITAR_REGISTRO: ['operacional', 'admin'],
    CONFERIR_REGISTRO: ['operacional', 'admin'],
    FINALIZAR_REGISTRO: ['operacional', 'admin'],
    CANCELAR_REGISTRO: ['admin'],
    IMPRIMIR_REGISTRO: ['operacional', 'admin'],
    GERENCIAR_MILITARES: ['admin'],
    GERENCIAR_USUARIOS: ['admin'],
    GERENCIAR_UNIDADES: ['admin'],
    CONFIGURACOES_SISTEMA: ['admin'],
    CONSULTAR_AUDITORIA: ['admin']
  };

  /**
   * Verifica se o usuário autenticado na sessão tem a permissão solicitada
   */
  function can(sessionUser, permissionKey) {
    if (!sessionUser || !sessionUser.perfil) return false;
    const allowedRoles = PERMISSIONS[permissionKey];
    if (!allowedRoles) return false;
    return allowedRoles.includes(sessionUser.perfil);
  }

  /**
   * Lança erro caso o usuário não tenha permissão
   */
  function requirePermission(sessionUser, permissionKey) {
    if (!can(sessionUser, permissionKey)) {
      throw new Error(`Acesso negado. Ação '${permissionKey}' requer privilégios específicos.`);
    }
  }

  return {
    PERMISSIONS: PERMISSIONS,
    can: can,
    requirePermission: requirePermission
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Authorization;
}
