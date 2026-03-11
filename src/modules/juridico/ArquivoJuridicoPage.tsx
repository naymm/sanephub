import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { FileText, FolderOpen, Scale, FileSignature, ShieldAlert } from 'lucide-react';

export default function ArquivoJuridicoPage() {
  const { contratos, rescissoesContrato, processosDisciplinares, processos, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [search, setSearch] = useState('');

  const getEmpresaNome = (id: number | undefined) => (id != null ? empresas.find(e => e.id === id)?.nome ?? String(id) : '—');
  const getContrato = (contratoId: number) => contratos.find(c => c.id === contratoId);

  const contratosComPdf = contratos.filter(c =>
    (c.ficheiroPdf?.trim()) &&
    (currentEmpresaId === 'consolidado' || c.empresaId == null || c.empresaId === currentEmpresaId)
  );
  const rescissoesComDoc = rescissoesContrato.filter(r =>
    (r.documentoPdf?.trim()) &&
    (currentEmpresaId === 'consolidado' || r.empresaId === currentEmpresaId)
  );
  const processosComRef = processos.filter(p =>
    currentEmpresaId === 'consolidado' || p.empresaId == null || p.empresaId === currentEmpresaId
  );

  const matchSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  const filteredContratos = contratosComPdf.filter(c =>
    matchSearch(c.numero) || matchSearch(c.objecto) || matchSearch(c.ficheiroPdf ?? '')
  );
  const filteredRescissoes = rescissoesComDoc.filter(r => {
    const c = getContrato(r.contratoId);
    return matchSearch(c?.numero ?? '') || matchSearch(r.documentoPdf ?? '') || matchSearch(r.tipo);
  });
  const filteredDisciplinares = processosDisciplinares.filter(p =>
    matchSearch(p.numero) || matchSearch(p.autoOcorrenciaPdf ?? '') || matchSearch(p.decisaoPdf ?? '')
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Arquivo Jurídico</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Referências a documentos e ficheiros do módulo Jurídico: contratos, rescisões, processos judiciais e disciplinares.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Pesquisar por número, objecto, nome de ficheiro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <section className="rounded-lg border border-border/80 overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 flex items-center gap-2 border-b">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Contratos (com PDF)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Nº</th>
                {currentEmpresaId === 'consolidado' && <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>}
                <th className="text-left p-3 font-medium text-muted-foreground">Objecto</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Ficheiro PDF</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Data fim</th>
              </tr>
            </thead>
            <tbody>
              {filteredContratos.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{c.numero}</td>
                  {currentEmpresaId === 'consolidado' && <td className="p-3 text-muted-foreground">{getEmpresaNome(c.empresaId)}</td>}
                  <td className="p-3 max-w-64 truncate" title={c.objecto}>{c.objecto}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-3 w-3" /> {c.ficheiroPdf}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.dataFim)}</td>
                </tr>
              ))}
              {filteredContratos.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground text-sm" colSpan={currentEmpresaId === 'consolidado' ? 5 : 4}>
                    Nenhum contrato com PDF registado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border/80 overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 flex items-center gap-2 border-b">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Rescisões Contratuais (documentos)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Contrato</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Data rescisão</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Documento PDF</th>
              </tr>
            </thead>
            <tbody>
              {filteredRescissoes.map(r => {
                const c = getContrato(r.contratoId);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">{c?.numero ?? `#${r.contratoId}`}</td>
                    <td className="p-3">{r.tipo}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(r.dataRescisao)}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <FileText className="h-3 w-3" /> {r.documentoPdf}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredRescissoes.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground text-sm" colSpan={4}>
                    Nenhuma rescisão com documento registada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border/80 overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 flex items-center gap-2 border-b">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Processos Judiciais</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Nº</th>
                {currentEmpresaId === 'consolidado' && <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>}
                <th className="text-left p-3 font-medium text-muted-foreground">Tribunal</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {processosComRef.filter(p => matchSearch(p.numero) || matchSearch(p.tribunal)).map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{p.numero}</td>
                  {currentEmpresaId === 'consolidado' && <td className="p-3 text-muted-foreground">{getEmpresaNome(p.empresaId)}</td>}
                  <td className="p-3 max-w-48 truncate">{p.tribunal}</td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(p.dataEntrada)}</td>
                </tr>
              ))}
              {processosComRef.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground text-sm" colSpan={currentEmpresaId === 'consolidado' ? 5 : 4}>
                    Nenhum processo judicial.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border/80 overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 flex items-center gap-2 border-b">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Processos Disciplinares (referência documental)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Nº</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Auto ocorrência PDF</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Despacho</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Convocatória</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Acta audiência</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Decisão PCA</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Comunicado</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDisciplinares.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{p.numero}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.autoOcorrenciaPdf ?? '—'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.despachoDelegacaoPdf ?? '—'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.convocatoriaPdf ?? '—'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.audienciaActaPdf ?? '—'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.decisaoPdf ?? '—'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.comunicadoPdf ?? '—'}</td>
                  <td className="p-3">{p.status}</td>
                </tr>
              ))}
              {filteredDisciplinares.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground text-sm" colSpan={8}>
                    Nenhum processo disciplinar com documentos referenciados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border/80 p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <FolderOpen className="h-4 w-4" />
          <span className="text-sm font-medium">Arquivo documental</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Os ficheiros PDF referenciados nesta página devem ser guardados no repositório de documentos da empresa (partilhada ou por empresa). 
          Esta vista serve como índice e referência rápida aos documentos do módulo Jurídico.
        </p>
      </section>
    </div>
  );
}
