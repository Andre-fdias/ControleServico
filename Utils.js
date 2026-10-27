/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Utils.js - Funções utilitárias de validação, formatação e proteção de integridade
 */

var Utils = (function() {
  /**
   * Gera um identificador único universal (UUID v4)
   */
  function generateId(prefix) {
    let raw = '';
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
      raw = Utilities.getUuid();
    } else if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      raw = crypto.randomUUID();
    } else {
      raw = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    return prefix ? `${prefix}_${raw}` : raw;
  }

  /**
   * Normaliza um RE (remove pontos, traços e espaços, mantendo apenas dígitos e hífen do dígito quando necessário)
   */
  function normalizeRE(re) {
    if (!re) return '';
    const clean = String(re).trim().toUpperCase();
    // Remove qualquer caractere que não seja dígito
    const digitsOnly = clean.replace(/\D/g, '');
    return digitsOnly;
  }

  /**
   * Formata RE com dígito para exibição (ex: 108154-3)
   */
  function formatRE(re, digito) {
    const r = normalizeRE(re);
    if (!r) return '';
    if (digito !== undefined && digito !== null && String(digito).trim() !== '') {
      return `${r}-${String(digito).trim()}`;
    }
    if (r.length === 7) {
      return `${r.slice(0, 6)}-${r.slice(6)}`;
    }
    return r;
  }

  /**
   * Formata a apresentação do militar com separação apenas por espaço:
   * Ex: "1º Sgt PM 108154-3 André Fonseca Dias"
   */
  function formatMilitarDisplay(graduacao, re, digito, nomeCompleto) {
    const grad = graduacao ? String(graduacao).trim() : 'MILITAR';
    const reFormatado = formatRE(re, digito);
    const nome = nomeCompleto ? String(nomeCompleto).trim() : '';
    return `${grad} ${reFormatado} ${nome}`.replace(/\s+/g, ' ').trim();
  }

  /**
   * Sanitiza strings para gravação na planilha, impedindo Formula Injection (=, +, -, @)
   */
  function sanitizeCellValue(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    const str = String(val);
    if (str.length > 0 && (/^[=+\-@\t\r]/.test(str))) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Converte valor para inteiro não negativo com valor padrão 0
   */
  function parseNonNegativeInt(val, defaultVal = 0) {
    if (val === null || val === undefined || val === '') return defaultVal;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return defaultVal;
    return num;
  }

  /**
   * Converte data ISO (YYYY-MM-DD) ou objeto Date para string no formato brasileiro (DD/MM/YYYY)
   */
  function formatDateBR(dateVal) {
    if (!dateVal) return '';
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const parts = dateVal.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Retorna timestamp ISO local de São Paulo
   */
  function nowTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Retorna hash SHA-256 seguro
   */
  function sha256(text, salt = '') {
    const input = String(text) + String(salt);
    if (typeof Utilities !== 'undefined' && Utilities.computeDigest && Utilities.DigestAlgorithm) {
      const bytes = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        input,
        Utilities.Charset.UTF_8
      );
      return bytes.map(function(b) {
        return ('0' + (b & 0xFF).toString(16)).slice(-2);
      }).join('');
    }
    if (typeof require !== 'undefined') {
      try {
        const cryptoMod = require('crypto');
        return cryptoMod.createHash('sha256').update(input).digest('hex');
      } catch (e) {}
    }
    return input; // Fallback para ambiente sem crypto
  }

  return {
    generateId: generateId,
    normalizeRE: normalizeRE,
    formatRE: formatRE,
    formatMilitarDisplay: formatMilitarDisplay,
    sanitizeCellValue: sanitizeCellValue,
    parseNonNegativeInt: parseNonNegativeInt,
    formatDateBR: formatDateBR,
    nowTimestamp: nowTimestamp,
    sha256: sha256
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
