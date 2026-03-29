import { jsPDF } from "jspdf"

const MESES = [
"Janeiro","Fevereiro","Março","Abril","Maio","Junho",
"Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
]

function fmtNum(n:number){
const [i,d] = n.toFixed(2).split(".")
return i.replace(/\B(?=(\d{3})+(?!\d))/g," ") + "," + d
}

function fmtNumTable(n:number){
const [i,d] = n.toFixed(2).split(".")
return i.replace(/\B(?=(\d{3})+(?!\d))/g,".") + "," + d
}

function periodo(mesAno:string){
const [,m] = mesAno.split("-").map(Number)
return MESES[m-1]
}

function dataFecho(mesAno:string){
const [y,m] = mesAno.split("-").map(Number)
const d = new Date(y,m,0)
return d.toLocaleDateString("pt-PT")
}

function dataCodigo(mesAno:string){
const [y,m] = mesAno.split("-")
return `${m}-${y}`
}

const EMPRESA = {
nome:"Sanep SGPS, SA",
nif:"5417626708",
niss:"004103320",
morada:"Rua Direita da Samba, Edificio LGT, 1º Andar"
}

const DIAS_MES = 22
const CAMBIO = 500

export function gerarPdfRecibo(recibo:any,colaborador:any, opts?: { irtTaxaPercent?: number | null }): string {

const doc = new jsPDF({unit:"mm",format:"a4"})
const pageW = doc.internal.pageSize.getWidth()

const left = 14
const right = pageW-14
let y = 12

doc.setFont("helvetica","normal")
doc.setFontSize(8)

doc.setFont("helvetica","bold")
doc.text(EMPRESA.nome,left,y)
doc.setFont("helvetica","normal")
doc.text(`NIF ${EMPRESA.nif} | INSS ${EMPRESA.niss}`,left,y+4)
doc.text(EMPRESA.morada,right,y,{align:"right"})

y+=20

doc.setFontSize(10)
doc.text("Original",left,y)

y+=8

doc.setFont("helvetica","bold")
doc.setFontSize(13)

doc.text("Recibo de Vencimentos",left,y)
doc.setLineWidth(0.2)
doc.line(left,y+2,right,y+2)

y+=10

doc.setFontSize(8)
doc.setFont("helvetica","normal")

const col1 = left
const col2 = pageW/2+5

const vencHora = recibo.vencimentoBase/(DIAS_MES*8)

doc.setFont("helvetica", "bold")
doc.text("Período",col1,y)
doc.setFont("helvetica", "normal")
doc.text(periodo(recibo.mesAno),col1+35,y)

doc.setFont("helvetica", "bold")
doc.text("Nome",col2,y)
doc.setFont("helvetica", "normal")
doc.text(colaborador.nome,col2+35,y)

y+=5

doc.setFont("helvetica", "bold")
doc.text("Data Fecho",col1,y)
doc.setFont("helvetica", "normal")
doc.text(dataFecho(recibo.mesAno),col1+35,y)

doc.setFont("helvetica", "bold")
doc.text("N.º Mecan.",col2,y)
doc.setFont("helvetica", "normal")
doc.text(String(100+colaborador.id),col2+35,y)

y+=5
doc.setFont("helvetica", "bold")
doc.text("Vencimento",col1,y)

doc.setFont("helvetica", "normal")
doc.text(fmtNum(recibo.vencimentoBase),col1+35,y)

doc.setFont("helvetica", "bold")
doc.text("Departamento",col2,y)
doc.setFont("helvetica", "normal")
doc.text(colaborador.departamento,col2+35,y)

y+=5

doc.setFont("helvetica", "bold")
doc.text("Venc. / Hora",col1,y)
doc.setFont("helvetica", "normal")
doc.text(fmtNum(vencHora),col1+35,y)

y+=5

doc.setFont("helvetica", "bold")
doc.text("N. Dias Mês",col1,y)
doc.setFont("helvetica", "normal")
doc.text(DIAS_MES.toFixed(2),col1+35,y)

y+=5

doc.setFont("helvetica", "bold")
doc.text("Câmbio AKZ",col1,y)
doc.setFont("helvetica", "normal")
doc.text(CAMBIO.toFixed(2).replace(".",","),col1+35,y)

y+=10

doc.setLineWidth(0.2)

y+=6

// tabela

const colX=[
left,
left+14,
left+34,
left+112,
left+142,
right
]

doc.setFont("helvetica","bold")
doc.setFontSize(8)

doc.line(left,y-3,right,y-3)

doc.text("Cód.",colX[0]+2,y)
doc.text("Data",colX[1]+2,y)
doc.text("Descrição",colX[2]+2,y)
doc.text("Remunerações",colX[4]-2,y,{align:"right"})
doc.text("Descontos",colX[5]-2,y,{align:"right"})

doc.line(left,y+2,right,y+2)

doc.setFont("helvetica","normal")

y+=8

const dataCod = dataCodigo(recibo.mesAno)

// Aceita número ou string vinda da BD (ex. taxa_percent do Postgres).
const irtTaxaNum = Number(opts?.irtTaxaPercent);
const irtLabel = Number.isFinite(irtTaxaNum)
  ? `IRT (${String(irtTaxaNum).replace(".", ",")}%)`
  : "IRT (0%)";

const linhas = [
  { cod: "R01", desc: "Vencimento", rem: recibo.vencimentoBase, des: 0 },
  { cod: "R11", desc: "Subsídio de alimentação", rem: recibo.subsidioAlimentacao, des: 0 },
  { cod: "R13", desc: "Subsídio de transporte", rem: recibo.subsidioTransporte, des: 0 },
  { cod: "R14", desc: "Outros subsídios", rem: recibo.outrosSubsidios, des: 0 },
  { cod: "D01", desc: "Segurança Social (3%)", rem: 0, des: recibo.inss },
  { cod: "D02", desc: irtLabel, rem: 0, des: recibo.irt }
]

linhas.forEach(l => {
  doc.text(l.cod, colX[0] + 2, y)
  doc.text(dataCod, colX[1] + 2, y)
  doc.text(l.desc, colX[2] + 2, y)

  if (l.rem > 0)
    doc.text(fmtNumTable(l.rem), colX[4] - 2, y, { align: "right" })

  if (l.des > 0)
    doc.text(fmtNumTable(l.des), colX[5] - 2, y, { align: "right" })

  // --- Linha cinza fina entre linhas da tabela ---
  doc.setLineWidth(0.1)
  doc.setDrawColor(150, 150, 150) // cinza médio
  doc.line(left, y + 2, right, y + 2)
  doc.setDrawColor(0, 0, 0) // repõe preto
  // ------------------------------

  y += 6
})

y+=2

doc.setLineWidth(0.2)
doc.line(left,y,right,y)

y+=30

const totalRem =
recibo.vencimentoBase+
recibo.subsidioAlimentacao+
recibo.subsidioTransporte+
recibo.outrosSubsidios

const totalDesc =
recibo.inss+
recibo.irt


doc.setFont("helvetica","bold")
doc.text("Total",colX[3]-2,y,{align:"right"})
doc.text(fmtNum(totalRem),colX[4]-2,y,{align:"right"})
doc.text(fmtNum(totalDesc),colX[5]-2,y,{align:"right"})

y+=12

doc.text("Total Pago (AKZ):",left+120,y)
doc.text(fmtNum(recibo.liquido),right,y,{align:"right"})

y+=6

doc.setFont("helvetica","normal")
doc.text("Total Pago (USD):",left+120,y)
doc.text((recibo.liquido/CAMBIO).toFixed(2),right,y,{align:"right"})

y+=14

doc.text("Declaro que recebi a quantia constante neste recibo,",left,y)

doc.line(left,y+5,left+80,y+5)

doc.setFontSize(7)
doc.text("© PRIMAVERA BSS / Licença de: SANEP-SGPS, SA",left,285)

const blob = doc.output("blob")
return URL.createObjectURL(blob)
}