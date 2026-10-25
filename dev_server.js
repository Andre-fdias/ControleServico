/**
 * SERVIDOR DE DESENVOLVIMENTO LOCAL (DEV SERVER)
 * Executa o Web App localmente em Node.js puro sem dependências externas.
 * Renderiza os templates <?!= include(...) ?> e expõe as funções RPC do Code.js via POST /api/:action.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Configura ambiente global simulando Google Apps Script
const Config = require('./Config.js');
const Utils = require('./Utils.js');
global.Config = Config;
global.Utils = Utils;

const Database = require('./Database.js');
global.Database = Database;

const Audit = require('./Audit.js');
global.Audit = Audit;

const Session = require('./Session.js');
global.Session = Session;

const Authorization = require('./Authorization.js');
global.Authorization = Authorization;

const Militares = require('./Militares.js');
global.Militares = Militares;

const Users = require('./Users.js');
global.Users = Users;

const Auth = require('./Auth.js');
global.Auth = Auth;

const Unidades = require('./Unidades.js');
global.Unidades = Unidades;

const Prontidao = require('./Prontidao.js');
global.Prontidao = Prontidao;

const SecoesOperacionais = require('./SecoesOperacionais.js');
global.SecoesOperacionais = SecoesOperacionais;

const Conferencias = require('./Conferencias.js');
global.Conferencias = Conferencias;

const RegistroAtividades = require('./RegistroAtividades.js');
global.RegistroAtividades = RegistroAtividades;

const Reports = require('./Reports.js');
global.Reports = Reports;

const Backup = require('./Backup.js');
global.Backup = Backup;

const SeedData = require('./SeedData.js');
global.SeedData = SeedData;

const Code = require('./Code.js');
global.Code = Code;


// 2. Mock robusto de Planilha Google em memória
function createMockSpreadsheet() {
  const sheets = {};

  function createMockSheet(name) {
    const data = [];
    return {
      getName: () => name,
      getLastRow: () => data.length,
      getLastColumn: () => (data.length > 0 ? data[0].length : 0),
      setFrozenRows: () => {},
      appendRow: (rowValues) => {
        data.push([...rowValues]);
      },
      deleteRow: (rowIdx) => {
        data.splice(rowIdx - 1, 1);
      },
      getRange: (startRow, startCol, numRows = 1, numCols = 1) => {
        return {
          getValues: () => {
            const result = [];
            for (let r = 0; r < numRows; r++) {
              const rowIdx = startRow - 1 + r;
              const rowData = data[rowIdx] || [];
              const rowSlice = [];
              for (let c = 0; c < numCols; c++) {
                const colIdx = startCol - 1 + c;
                rowSlice.push(rowData[colIdx] !== undefined ? rowData[colIdx] : '');
              }
              result.push(rowSlice);
            }
            return result;
          },
          setValues: (values) => {
            for (let r = 0; r < values.length; r++) {
              const targetRowIdx = startRow - 1 + r;
              while (data.length <= targetRowIdx) data.push([]);
              for (let c = 0; c < values[r].length; c++) {
                const targetColIdx = startCol - 1 + c;
                data[targetRowIdx][targetColIdx] = values[r][c];
              }
            }
          },
          setValue: (val) => {
            const targetRowIdx = startRow - 1;
            while (data.length <= targetRowIdx) data.push([]);
            data[targetRowIdx][startCol - 1] = val;
          }
        };
      }
    };
  }

  return {
    getSheetByName: (name) => sheets[name] || null,
    insertSheet: (name) => {
      const s = createMockSheet(name);
      sheets[name] = s;
      return s;
    },
    getAllSheetNames: () => Object.keys(sheets)
  };
}

const mockSpreadsheet = createMockSpreadsheet();
Database.setSpreadsheetOverride(mockSpreadsheet);

// Inicializa o banco em memória e carrega dados de semente (militares, unidades, admin)
Database.initializeSchema(mockSpreadsheet);
Auth.ensureDefaultAdmin();
Unidades.ensureDefaultGrupamentos();
Unidades.ensureDefaultPostos();
SeedData.populateSeedData();

// Cria um registro inicial de exemplo para o dashboard já vir com dados reais
const adminUser = { re: 'admin', nome_completo: 'Administrador do Sistema', perfil: 'admin' };
RegistroAtividades.create({
  data_inicio: '2026-10-25',
  hora_inicio: '07:30',
  sgb: '2º SGB',
  pb_id: 'pb_sroque',
  cmt_re: '108154'
}, adminUser);

/**
 * Avalia templates <?!= include('NomeDoArquivo') ?>
 */
function renderTemplate(filename) {
  const filePath = path.join(__dirname, `${filename}.html`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Substitui recursivamente os includes
  content = content.replace(/<\?!=\s*include\(['"]([^'"]+)['"]\)\s*\?>/g, (match, incFile) => {
    return renderTemplate(incFile);
  });

  return content;
}

// 3. Cria o servidor HTTP
const PORT = process.env.PORT || 3000;
const server = http.createServer(async (req, res) => {
  // Rota RPC: POST /api/:action
  if (req.method === 'POST' && req.url.startsWith('/api/')) {
    const action = req.url.replace('/api/', '');
    let bodyStr = '';

    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      let args = [];
      try {
        args = JSON.parse(bodyStr || '[]');
      } catch (e) {}

      if (typeof Code[action] === 'function') {
        try {
          const result = await Code[action](...args);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `Ação RPC ${action} não encontrada.` }));
      }
    });
    return;
  }

  // Rota principal: GET /
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = renderTemplate('Index');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro ao renderizar template: ' + e.message);
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Página não encontrada.');
});

server.listen(PORT, () => {
  console.log(`[DEV SERVER] Servidor do Livro de Registro de Atividades rodando em http://localhost:${PORT}`);
});
