import type { ReciboSalario } from '@/types';
import type { Colaborador } from '@/types';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmtNum(n: number): string {
  const [int, dec] = n.toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
}

function fmtNumTable(n: number): string {
  const [int, dec] = n.toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}

function dataFecho(mesAno: string): string {
  const [y, m] = mesAno.split('-').map(Number);
  const last = new Date(y, m, 0);
  const d = String(last.getDate()).padStart(2, '0');
  const mm = String(last.getMonth() + 1).padStart(2, '0');
  return `${d}/${mm}/${y}`;
}

function periodo(mesAno: string): string {
  const m = parseInt(mesAno.slice(5), 10);
  return MESES[m - 1] ?? '';
}

function dataCodigo(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  return `${m}-${y}`;
}

const EMPRESA = {
  nome: 'Sanep SGPS, SA',
  nif: '5417626708',
  niss: '004103320',
  morada: 'Rua Direita da Samba, Edificio LGT, 1º Andar',
};

const DIAS_MES = 22;
const CAMBIO_AKZ_USD = 500;

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 18mm 15mm;
    line-height: 1.35;
  }
  .recibo { max-width: 100%; }

  .header {
    margin-bottom: 14px;
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .header-left .company { font-weight: bold; font-size: 12px; }
  .header-left .fiscal { font-size: 10px; color: #333; margin-top: 2px; }
  .header-right { text-align: right; font-size: 10px; }
  .header-duplicado { font-size: 10px; margin-bottom: 6px; }
  .header-title {
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-bottom: 0;
    padding-bottom: 4px;
    border-bottom: 2px solid #000;
  }

  .employee-info {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 14px;
  }
  .employee-info .col {
    flex: 1;
    border: 1px solid #000;
    border-collapse: collapse;
  }
  .employee-info .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    border-bottom: 1px solid #000;
    min-height: 24px;
  }
  .employee-info .row:last-child { border-bottom: none; }
  .employee-info .label { font-weight: normal; }
  .employee-info .value { text-align: right; }
  .employee-info .col-right .value { text-align: left; margin-left: 8px; }

  .faltas-irt {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 14px;
  }
  .faltas-section, .irt-section { flex: 0 0 auto; }
  .faltas-section h3, .irt-section h3 {
    font-size: 10px;
    font-weight: bold;
    margin: 0 0 4px 0;
    padding: 0;
  }
  .irt-section h3 { text-align: right; }
  .faltas-table {
    border-collapse: collapse;
    font-size: 10px;
  }
  .faltas-table th, .faltas-table td {
    border: 1px solid #000;
    padding: 4px 6px;
    text-align: center;
    min-width: 32px;
  }
  .faltas-table th { font-weight: bold; }
  .irt-section .irt-rows { text-align: right; }
  .irt-section .irt-row { margin-bottom: 2px; }

  .salary-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 10px;
  }
  .salary-table th, .salary-table td {
    border: 1px solid #000;
    padding: 5px 8px;
    vertical-align: middle;
  }
  .salary-table th { font-weight: bold; }
  .salary-table .col-cod { width: 10%; text-align: left; }
  .salary-table .col-data { width: 12%; text-align: left; }
  .salary-table .col-desc { width: 42%; text-align: left; }
  .salary-table .col-remun { width: 18%; text-align: right; }
  .salary-table .col-desc-cont { width: 18%; text-align: right; }
  .salary-table td.col-remun, .salary-table td.col-desc-cont { text-align: right; }

  .totals {
    margin-bottom: 14px;
  }
  .totals .row-total {
    display: grid;
    grid-template-columns: 10% 12% 42% 18% 18%;
    align-items: center;
    padding: 6px 0 10px 0;
    font-weight: bold;
    font-size: 11px;
    width: 100%;
    border-top: 1px solid #000;
  }
  .totals .row-total .label { grid-column: 1; }
  .totals .row-total .val-remun { grid-column: 4; text-align: right; padding-right: 8px; }
  .totals .row-total .val-desc { grid-column: 5; text-align: right; padding-right: 8px; }
  .totals .row-pago { text-align: right; padding: 2px 0; font-size: 11px; }
  .totals .row-pago .label { margin-right: 8px; }

  .payment-method {
    margin-bottom: 16px;
  }
  .payment-method h3 { font-size: 10px; font-weight: bold; margin: 0 0 4px 0; }
  .payment-method-table {
    border-collapse: collapse;
    font-size: 10px;
  }
  .payment-method-table th, .payment-method-table td {
    border: 1px solid #000;
    padding: 4px 8px;
  }
  .payment-method-table th { font-weight: bold; }
  .payment-method-table .col-pct { width: 12%; text-align: left; }
  .payment-method-table .col-remun { width: 25%; text-align: center; }
  .payment-method-table .col-forma { width: 43%; text-align: left; }
  .payment-method-table .col-moeda { width: 20%; text-align: left; }

  .footer {
    margin-top: 20px;
    font-size: 10px;
  }
  .footer-declaration { margin-bottom: 6px; }
  .footer-sign-line {
    width: 200px;
    border-bottom: 1px solid #000;
    margin-bottom: 14px;
  }
  .footer-obs {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }
  .footer-copy {
    font-size: 8px;
    color: #333;
  }

  @media print {
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      padding: 0;
      margin: 0;
    }
    .recibo { max-width: 100%; }
    .header, .employee-info, .salary-table, .totals, .payment-method, .footer {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getReciboPrintHtml(recibo: ReciboSalario, colaborador: Colaborador): string {
  const totalRemun = recibo.vencimentoBase + recibo.subsidioAlimentacao + recibo.subsidioTransporte + recibo.outrosSubsidios;
  const totalDeducoes = recibo.inss + recibo.irt + recibo.outrasDeducoes;
  const vencHora = DIAS_MES > 0 ? recibo.vencimentoBase / (DIAS_MES * 8) : 0;
  const dataCod = dataCodigo(recibo.mesAno);
  const numMecan = 100 + colaborador.id;
  const numBenef = colaborador.niss?.slice(0, 9).padStart(9, '0') ?? String(colaborador.id).padStart(9, '0');
  const numContrib = colaborador.niss ?? '';

  const linhas: { cod: string; desc: string; remun: number; descVal: number }[] = [
    { cod: 'R01', desc: 'Vencimento', remun: recibo.vencimentoBase, descVal: 0 },
    { cod: 'R11', desc: 'Subsídio de alimentação', remun: recibo.subsidioAlimentacao, descVal: 0 },
    { cod: 'R13', desc: 'Subsídio de transporte', remun: recibo.subsidioTransporte, descVal: 0 },
  ];
  if (recibo.outrosSubsidios > 0) {
    linhas.push({ cod: 'R14', desc: 'Subsídio de disponibilidade', remun: recibo.outrosSubsidios, descVal: 0 });
  }
  linhas.push(
    { cod: 'D01', desc: 'Segurança Social (3%)', remun: 0, descVal: recibo.inss },
    { cod: 'D02', desc: 'IRT (19%)', remun: 0, descVal: recibo.irt },
  );
  if (recibo.outrasDeducoes > 0) {
    linhas.push({ cod: 'D03', desc: 'Outras deduções', remun: 0, descVal: recibo.outrasDeducoes });
  }

  const tableRows = linhas
    .map(
      (l) => `
    <tr>
      <td class="col-cod">${escapeHtml(l.cod)}</td>
      <td class="col-data">${escapeHtml(dataCod)}</td>
      <td class="col-desc">${escapeHtml(l.desc)}</td>
      <td class="col-remun">${l.remun > 0 ? fmtNumTable(l.remun) : ''}</td>
      <td class="col-desc-cont">${l.descVal > 0 ? fmtNumTable(l.descVal) : ''}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo de Vencimentos - ${escapeHtml(colaborador.nome)} - ${recibo.mesAno}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="recibo">
    <header class="header">
      <div class="header-top">
        <div class="header-left">
          <div class="company">${escapeHtml(EMPRESA.nome)}</div>
          <div class="fiscal">NIF ${EMPRESA.nif} | INSS ${EMPRESA.niss}</div>
        </div>
        <div class="header-right">${escapeHtml(EMPRESA.morada)}</div>
      </div>
      <div class="header-duplicado">Duplicado</div>
      <h1 class="header-title">Recibo de Vencimentos</h1>
    </header>

    <section class="employee-info">
      <div class="col">
        <div class="row"><span class="label">Período</span><span class="value">${escapeHtml(periodo(recibo.mesAno))}</span></div>
        <div class="row"><span class="label">Data Fecho</span><span class="value">${dataFecho(recibo.mesAno)}</span></div>
        <div class="row"><span class="label">Vencimento</span><span class="value">${fmtNum(recibo.vencimentoBase)}</span></div>
        <div class="row"><span class="label">Venc. / Hora</span><span class="value">${fmtNum(vencHora)}</span></div>
        <div class="row"><span class="label">N. Dias Mês</span><span class="value">${DIAS_MES.toFixed(2)}</span></div>
        <div class="row"><span class="label">Câmbio AKZ</span><span class="value">${CAMBIO_AKZ_USD.toFixed(5).replace('.', ',')}</span></div>
      </div>
      <div class="col col-right">
        <div class="row"><span class="label">Nome</span><span class="value">${escapeHtml(colaborador.nome)}</span></div>
        <div class="row"><span class="label">N.º Mecan.</span><span class="value">${numMecan}</span></div>
        <div class="row"><span class="label">Categoria</span><span class="value"></span></div>
        <div class="row"><span class="label">N.º Benef.</span><span class="value">${escapeHtml(numBenef)}</span></div>
        <div class="row"><span class="label">N.º Contrib.</span><span class="value">${escapeHtml(numContrib)}</span></div>
        <div class="row"><span class="label">Departamento</span><span class="value">${escapeHtml(colaborador.departamento)}</span></div>
        <div class="row"><span class="label">Seguro</span><span class="value"></span></div>
      </div>
    </section>

    <section class="faltas-irt">
      <div class="faltas-section">
        <h3>Faltas</h3>
        <table class="faltas-table">
          <thead><tr><th>Alim.</th><th>Tumo</th><th>CDH</th><th>CDD</th><th>SDH</th><th>SDD</th></tr></thead>
          <tbody><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
        </table>
      </div>
      <div class="irt-section">
        <h3>Retenção IRT</h3>
        <div class="irt-rows">
          <div class="irt-row">IRT Retido ${fmtNum(recibo.irt)}</div>
          <div class="irt-row">Total Remun. ${fmtNum(totalRemun)}</div>
        </div>
      </div>
    </section>

    <section class="salary-table-wrap">
      <table class="salary-table">
        <thead>
          <tr>
            <th class="col-cod">Cód.</th>
            <th class="col-data">Data</th>
            <th class="col-desc">Descrição</th>
            <th class="col-remun">Remunerações</th>
            <th class="col-desc-cont">Descontos</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>

    <section class="totals">
      <div class="row-total">
        <span class="label">Total</span>
        <span></span>
        <span class="val-remun">${fmtNum(totalRemun)}</span>
        <span class="val-desc">${fmtNum(totalDeducoes)}</span>
      </div>
      <div class="row-pago">Total Pago (AKZ): ${fmtNum(recibo.liquido)}</div>
      <div class="row-pago">Total Pago (USD): ${(recibo.liquido / CAMBIO_AKZ_USD).toFixed(2)}</div>
    </section>

    <section class="payment-method">
      <h3>Formas de Pagamento:</h3>
      <table class="payment-method-table">
        <thead>
          <tr>
            <th class="col-pct">%</th>
            <th class="col-remun">Remuneração</th>
            <th class="col-forma">Forma de Pagamento</th>
            <th class="col-moeda">Moeda</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>100,00</td>
            <td></td>
            <td>Transferência</td>
            <td>AKZ</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer class="footer">
      <div class="footer-declaration">Declaro que recebi a quantia constante neste recibo,</div>
      <div class="footer-sign-line"></div>
      <div class="footer-obs">Obs.</div>
      <div class="footer-copy">© PRIMAVERA BSS / Licença de: SANEP - SGPS, SA.</div>
    </footer>
  </div>
</body>
</html>`;
}

/** Abre o recibo numa nova janela e dispara a impressão (o utilizador pode escolher "Guardar como PDF"). */
export function imprimirRecibo(recibo: ReciboSalario, colaborador: Colaborador): void {
  const html = getReciboPrintHtml(recibo, colaborador);
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
