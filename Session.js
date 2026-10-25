/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Session.js - Gerenciamento de sessões seguras no servidor
 */

const Session = (function() {
  const SESSION_TTL_SECONDS = 28800; // 8 horas
  const _memorySessions = {}; // Fallback em memória e para testes locais

  /**
   * Cria um token de sessão imprevisível
   */
  function create(user) {
    const raw = `${user.id}:${user.re}:${Date.now()}:${Utils.generateId()}`;
    const token = Utils.sha256(raw, 'CBM_SESSION_TOKEN_SALT');
    const sessionData = {
      userId: user.id,
      re: user.re,
      nome_completo: user.nome_completo,
      perfil: user.perfil,
      expiresAt: Date.now() + (SESSION_TTL_SECONDS * 1000)
    };

    _memorySessions[token] = sessionData;

    if (typeof CacheService !== 'undefined') {
      try {
        const cache = CacheService.getUserCache() || CacheService.getScriptCache();
        if (cache) {
          cache.put(token, JSON.stringify(sessionData), SESSION_TTL_SECONDS);
        }
      } catch (e) {}
    }

    return token;
  }

  /**
   * Valida o token e retorna os dados de sessão do usuário ou null
   */
  function validate(token) {
    if (!token) return null;

    // 1. Verifica cache em memória
    if (_memorySessions[token]) {
      const sess = _memorySessions[token];
      if (sess.expiresAt > Date.now()) {
        return sess;
      }
      delete _memorySessions[token];
      return null;
    }

    // 2. Verifica CacheService do Google Apps Script
    if (typeof CacheService !== 'undefined') {
      try {
        const cache = CacheService.getUserCache() || CacheService.getScriptCache();
        if (cache) {
          const cachedJson = cache.get(token);
          if (cachedJson) {
            const data = JSON.parse(cachedJson);
            if (data.expiresAt > Date.now()) {
              _memorySessions[token] = data; // Reabastece memória local
              return data;
            }
          }
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Destrói a sessão (Logout)
   */
  function destroy(token) {
    if (!token) return true;
    delete _memorySessions[token];
    if (typeof CacheService !== 'undefined') {
      try {
        const cache = CacheService.getUserCache() || CacheService.getScriptCache();
        if (cache) {
          cache.remove(token);
        }
      } catch (e) {}
    }
    return true;
  }

  return {
    create: create,
    validate: validate,
    destroy: destroy
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Session;
}
