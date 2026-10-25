/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Database.js - Camada centralizada de acesso a dados (Google Sheets)
 * Leitura e gravação em lote, LockService para concorrência e inicialização idempotente de esquema.
 */

const Database = (function() {
  let _spreadsheetOverride = null;

  function getSpreadsheet() {
    if (_spreadsheetOverride) {
      return _spreadsheetOverride;
    }
    if (typeof SpreadsheetApp !== 'undefined') {
      try {
        const active = SpreadsheetApp.getActiveSpreadsheet();
        if (active) return active;
      } catch (e) {}

      let sheetId = Config.SPREADSHEET_ID;
      try {
        if (typeof PropertiesService !== 'undefined') {
          const propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
          if (propId) sheetId = propId;
        }
      } catch (e) {}

      if (sheetId) {
        return SpreadsheetApp.openById(sheetId);
      }
    }
    throw new Error('Planilha Google de banco de dados não configurada ou inacessível.');
  }

  function setSpreadsheetOverride(mock) {
    _spreadsheetOverride = mock;
  }

  /**
   * Normaliza o nome do cabeçalho
   */
  function normalizeHeader(h) {
    if (!h) return '';
    return String(h).trim().toLowerCase();
  }

  /**
   * Obtém ou cria a aba da planilha com seus cabeçalhos
   */
  function getOrCreateSheet(ss, sheetName, expectedHeaders) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (expectedHeaders && expectedHeaders.length > 0) {
        sheet.appendRow(expectedHeaders);
        try {
          sheet.setFrozenRows(1);
        } catch (e) {}
      }
    } else if (expectedHeaders && expectedHeaders.length > 0) {
      // Verifica se há colunas ausentes no cabeçalho existente
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        sheet.appendRow(expectedHeaders);
        try {
          sheet.setFrozenRows(1);
        } catch (e) {}
      } else {
        const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader);
        const missing = expectedHeaders.filter(h => !currentHeaders.includes(normalizeHeader(h)));
        if (missing.length > 0) {
          missing.forEach(col => {
            const nextCol = sheet.getLastColumn() + 1;
            sheet.getRange(1, nextCol).setValue(col);
          });
        }
      }
    }
    return sheet;
  }

  /**
   * Converte linha de array em objeto com base nos cabeçalhos
   */
  function rowToObject(headers, row) {
    const obj = {};
    headers.forEach((h, index) => {
      const key = normalizeHeader(h);
      if (key) {
        let val = row[index];
        if (val === undefined || val === null) {
          val = '';
        } else if (typeof val === 'string' && val.startsWith("'") && /^[=+\-@]/.test(val.slice(1))) {
          val = val.slice(1); // Remove prefixo de proteção de fórmula na leitura
        }
        obj[key] = val;
      }
    });
    return obj;
  }

  /**
   * Converte objeto em linha de array com base nos cabeçalhos
   */
  function objectToRow(headers, obj) {
    return headers.map(h => {
      const key = normalizeHeader(h);
      const val = obj[key] !== undefined ? obj[key] : (obj[h] !== undefined ? obj[h] : '');
      return Utils.sanitizeCellValue(val);
    });
  }

  /**
   * Retorna todos os registros de uma aba como array de objetos
   */
  function getAll(sheetName) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) return [];

    const rangeValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = rangeValues[0];
    const rows = rangeValues.slice(1);

    return rows.map(r => rowToObject(headers, r));
  }

  /**
   * Retorna registros que atendem ao predicado
   */
  function find(sheetName, predicate) {
    const all = getAll(sheetName);
    return all.filter(predicate);
  }

  /**
   * Retorna registros que correspondem a um objeto de critérios
   */
  function findWhere(sheetName, criteria) {
    const all = getAll(sheetName);
    return all.filter(item => {
      return Object.keys(criteria).every(key => {
        const normKey = normalizeHeader(key);
        return String(item[normKey] || '').toLowerCase() === String(criteria[key] || '').toLowerCase();
      });
    });
  }

  /**
   * Retorna um único registro por ID estável
   */
  function getById(sheetName, id) {
    if (!id) return null;
    const all = getAll(sheetName);
    const target = String(id).trim();
    return all.find(item => String(item.id).trim() === target) || null;
  }

  /**
   * Insere um novo registro com controle de Lock
   */
  function insert(sheetName, record) {
    let lock = null;
    if (typeof LockService !== 'undefined') {
      try {
        lock = LockService.getScriptLock();
        lock.waitLock(10000);
      } catch (e) {
        lock = null;
      }
    }

    try {
      const ss = getSpreadsheet();
      const expectedHeaders = Config.SCHEMAS[sheetName] || [];
      const sheet = getOrCreateSheet(ss, sheetName, expectedHeaders);

      if (!record.id) {
        record.id = Utils.generateId(sheetName.slice(0, 3).toLowerCase());
      }
      if (!record.criado_em && expectedHeaders.includes('criado_em')) {
        record.criado_em = Utils.nowTimestamp();
      }
      if (expectedHeaders.includes('atualizado_em')) {
        record.atualizado_em = Utils.nowTimestamp();
      }

      const lastCol = sheet.getLastColumn();
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const row = objectToRow(headers, record);
      sheet.appendRow(row);

      return record;
    } finally {
      if (lock) {
        try { lock.releaseLock(); } catch (e) {}
      }
    }
  }

  /**
   * Insere múltiplos registros em lote com Lock
   */
  function insertBatch(sheetName, records) {
    if (!records || records.length === 0) return [];

    let lock = null;
    if (typeof LockService !== 'undefined') {
      try {
        lock = LockService.getScriptLock();
        lock.waitLock(15000);
      } catch (e) {
        lock = null;
      }
    }

    try {
      const ss = getSpreadsheet();
      const expectedHeaders = Config.SCHEMAS[sheetName] || [];
      const sheet = getOrCreateSheet(ss, sheetName, expectedHeaders);

      const lastCol = sheet.getLastColumn();
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const now = Utils.nowTimestamp();

      const rows = records.map(rec => {
        if (!rec.id) {
          rec.id = Utils.generateId(sheetName.slice(0, 3).toLowerCase());
        }
        if (!rec.criado_em && expectedHeaders.includes('criado_em')) {
          rec.criado_em = now;
        }
        if (expectedHeaders.includes('atualizado_em')) {
          rec.atualizado_em = now;
        }
        return objectToRow(headers, rec);
      });

      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, lastCol).setValues(rows);

      return records;
    } finally {
      if (lock) {
        try { lock.releaseLock(); } catch (e) {}
      }
    }
  }

  /**
   * Atualiza um registro existente por ID estável
   */
  function update(sheetName, id, updateFields) {
    let lock = null;
    if (typeof LockService !== 'undefined') {
      try {
        lock = LockService.getScriptLock();
        lock.waitLock(10000);
      } catch (e) {
        lock = null;
      }
    }

    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Aba ${sheetName} não encontrada.`);

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow <= 1) throw new Error(`Registro ID ${id} não encontrado na aba ${sheetName}.`);

      const rangeValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = rangeValues[0];
      const idColIndex = headers.map(normalizeHeader).indexOf('id');
      if (idColIndex === -1) throw new Error(`Coluna ID não encontrada na aba ${sheetName}.`);

      const targetId = String(id).trim();
      let targetRowIndex = -1;

      for (let i = 1; i < rangeValues.length; i++) {
        if (String(rangeValues[i][idColIndex]).trim() === targetId) {
          targetRowIndex = i + 1; // 1-indexed
          break;
        }
      }

      if (targetRowIndex === -1) {
        throw new Error(`Registro com ID ${id} não encontrado na aba ${sheetName}.`);
      }

      const existingRecord = rowToObject(headers, rangeValues[targetRowIndex - 1]);
      const updatedRecord = Object.assign({}, existingRecord, updateFields);
      if (headers.map(normalizeHeader).includes('atualizado_em')) {
        updatedRecord.atualizado_em = Utils.nowTimestamp();
      }

      const updatedRow = objectToRow(headers, updatedRecord);
      sheet.getRange(targetRowIndex, 1, 1, lastCol).setValues([updatedRow]);

      return updatedRecord;
    } finally {
      if (lock) {
        try { lock.releaseLock(); } catch (e) {}
      }
    }
  }

  /**
   * Remove registros que correspondam a um critério (usado para substituir sub-itens de um registro)
   */
  function deleteWhere(sheetName, criteria) {
    let lock = null;
    if (typeof LockService !== 'undefined') {
      try {
        lock = LockService.getScriptLock();
        lock.waitLock(10000);
      } catch (e) {
        lock = null;
      }
    }

    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return 0;

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow <= 1) return 0;

      const rangeValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = rangeValues[0];
      let deletedCount = 0;

      // Itera de baixo para cima para deleção segura
      for (let i = rangeValues.length - 1; i >= 1; i--) {
        const item = rowToObject(headers, rangeValues[i]);
        const matches = Object.keys(criteria).every(key => {
          const normKey = normalizeHeader(key);
          return String(item[normKey] || '').toLowerCase() === String(criteria[key] || '').toLowerCase();
        });

        if (matches) {
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }

      return deletedCount;
    } finally {
      if (lock) {
        try { lock.releaseLock(); } catch (e) {}
      }
    }
  }

  /**
   * Inicializa o esquema completo de todas as abas da planilha
   */
  function initializeSchema(spreadsheet) {
    const ss = spreadsheet || getSpreadsheet();
    const report = {
      createdSheets: [],
      verifiedSheets: [],
      version: '1.0.0',
      timestamp: Utils.nowTimestamp()
    };

    const schemas = Config.SCHEMAS;
    const sheetNames = Object.keys(schemas);

    sheetNames.forEach(sheetName => {
      const expectedHeaders = schemas[sheetName];
      const existing = ss.getSheetByName(sheetName);
      if (!existing) {
        getOrCreateSheet(ss, sheetName, expectedHeaders);
        report.createdSheets.push(sheetName);
      } else {
        getOrCreateSheet(ss, sheetName, expectedHeaders);
        report.verifiedSheets.push(sheetName);
      }
    });

    // Registra a versão na aba SCHEMA_VERSOES
    try {
      const schemaVersoes = getAll('SCHEMA_VERSOES');
      if (schemaVersoes.length === 0) {
        insert('SCHEMA_VERSOES', {
          versao: '1.0.0',
          data_aplicacao: Utils.nowTimestamp(),
          status: 'APLICADO',
          detalhes: 'Inicialização completa do banco de dados do Livro de Registro de Atividades CBM'
        });
      }
    } catch (e) {}

    return report;
  }

  return {
    getSpreadsheet: getSpreadsheet,
    setSpreadsheetOverride: setSpreadsheetOverride,
    getAll: getAll,
    find: find,
    findWhere: findWhere,
    getById: getById,
    insert: insert,
    insertBatch: insertBatch,
    update: update,
    deleteWhere: deleteWhere,
    initializeSchema: initializeSchema
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Database;
}
