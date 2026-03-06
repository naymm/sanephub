import { useState, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import type { Colaborador } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, MapPin, Briefcase, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

/** Campos que o colaborador pode editar no portal (morada e contactos). */
type EditableContactFields = Pick<
  Colaborador,
  'endereco' | 'emailPessoal' | 'telefonePrincipal' | 'telefoneAlternativo' | 'contactoEmergenciaNome' | 'contactoEmergenciaTelefone'
>;

const emptyContact: EditableContactFields = {
  endereco: '',
  emailPessoal: '',
  telefonePrincipal: '',
  telefoneAlternativo: '',
  contactoEmergenciaNome: '',
  contactoEmergenciaTelefone: '',
};

export default function PortalDadosPage() {
  const colaboradorId = useColaboradorId();
  const { colaboradores, setColaboradores } = useData();
  const [form, setForm] = useState<EditableContactFields>(emptyContact);

  const colaborador = colaboradorId != null
    ? colaboradores.find(c => c.id === colaboradorId) ?? null
    : null;

  useEffect(() => {
    if (!colaborador) return;
    setForm({
      endereco: colaborador.endereco ?? '',
      emailPessoal: colaborador.emailPessoal ?? '',
      telefonePrincipal: colaborador.telefonePrincipal ?? '',
      telefoneAlternativo: colaborador.telefoneAlternativo ?? '',
      contactoEmergenciaNome: colaborador.contactoEmergenciaNome ?? '',
      contactoEmergenciaTelefone: colaborador.contactoEmergenciaTelefone ?? '',
    });
  }, [colaborador]);

  const handleSave = () => {
    if (!colaborador) return;
    setColaboradores(prev =>
      prev.map(c =>
        c.id === colaborador.id
          ? { ...c, ...form }
          : c
      )
    );
    toast.success('Dados actualizados com sucesso.');
  };

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Os Meus Dados</h1>
        <p className="text-muted-foreground text-center py-12">
          Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.
        </p>
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Os Meus Dados</h1>
        <p className="text-muted-foreground text-center py-12">
          Dados do colaborador não encontrados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="page-header">Os Meus Dados</h1>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-border">
            <AvatarFallback className="text-lg font-medium">
              {colaborador.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{colaborador.nome}</p>
            <p className="text-sm text-muted-foreground">{colaborador.cargo} · {colaborador.departamento}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados pessoais (só leitura) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Dados pessoais
            </CardTitle>
            <CardDescription>Informação do seu processo. Para alterações contacte os Recursos Humanos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Nome</span>
              <span>{colaborador.nome}</span>
              <span className="text-muted-foreground">Data de nascimento</span>
              <span>{formatDate(colaborador.dataNascimento)}</span>
              <span className="text-muted-foreground">Género</span>
              <span>{colaborador.genero === 'M' ? 'Masculino' : colaborador.genero === 'F' ? 'Feminino' : colaborador.genero}</span>
              <span className="text-muted-foreground">Estado civil</span>
              <span>{colaborador.estadoCivil}</span>
              <span className="text-muted-foreground">BI</span>
              <span>{colaborador.bi}</span>
              <span className="text-muted-foreground">NIF</span>
              <span>{colaborador.nif}</span>
              <span className="text-muted-foreground">NISS</span>
              <span>{colaborador.niss}</span>
              <span className="text-muted-foreground">Nacionalidade</span>
              <span>{colaborador.nacionalidade}</span>
            </div>
          </CardContent>
        </Card>

        {/* Dados profissionais (só leitura) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Dados profissionais
            </CardTitle>
            <CardDescription>Cargo, departamento e contrato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Cargo</span>
              <span>{colaborador.cargo}</span>
              <span className="text-muted-foreground">Departamento</span>
              <span>{colaborador.departamento}</span>
              <span className="text-muted-foreground">Email corporativo</span>
              <span>{colaborador.emailCorporativo}</span>
              <span className="text-muted-foreground">Data de admissão</span>
              <span>{formatDate(colaborador.dataAdmissao)}</span>
              <span className="text-muted-foreground">Tipo de contrato</span>
              <span>{colaborador.tipoContrato}</span>
              {colaborador.dataFimContrato && (
                <>
                  <span className="text-muted-foreground">Fim do contrato</span>
                  <span>{formatDate(colaborador.dataFimContrato)}</span>
                </>
              )}
              <span className="text-muted-foreground">Estado</span>
              <span>{colaborador.status}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dados bancários (só leitura) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Dados bancários
          </CardTitle>
          <CardDescription>IBAN para pagamento de salário. Para alterações contacte os Recursos Humanos.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-[80px_1fr] gap-x-4">
            <span className="text-muted-foreground">IBAN</span>
            <span className="font-mono">{colaborador.iban}</span>
          </div>
        </CardContent>
      </Card>
      {/* Morada e contactos (editável) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Morada e contactos
          </CardTitle>
          <CardDescription>Pode actualizar estes dados. As alterações ficarão registadas no seu processo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="endereco">Morada</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div>
              <Label htmlFor="telefonePrincipal">Telefone principal</Label>
              <Input
                id="telefonePrincipal"
                value={form.telefonePrincipal}
                onChange={e => setForm(f => ({ ...f, telefonePrincipal: e.target.value }))}
                placeholder="+244 900 000 000"
              />
            </div>
            <div>
              <Label htmlFor="telefoneAlternativo">Telefone alternativo</Label>
              <Input
                id="telefoneAlternativo"
                value={form.telefoneAlternativo}
                onChange={e => setForm(f => ({ ...f, telefoneAlternativo: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label htmlFor="emailPessoal">Email pessoal</Label>
              <Input
                id="emailPessoal"
                type="email"
                value={form.emailPessoal}
                onChange={e => setForm(f => ({ ...f, emailPessoal: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="sm:col-span-2 border-t pt-4 mt-2">
              <p className="text-sm font-medium text-muted-foreground mb-3">Contacto de emergência</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contactoEmergenciaNome">Nome</Label>
                  <Input
                    id="contactoEmergenciaNome"
                    value={form.contactoEmergenciaNome}
                    onChange={e => setForm(f => ({ ...f, contactoEmergenciaNome: e.target.value }))}
                    placeholder="Nome do contacto"
                  />
                </div>
                <div>
                  <Label htmlFor="contactoEmergenciaTelefone">Telefone</Label>
                  <Input
                    id="contactoEmergenciaTelefone"
                    value={form.contactoEmergenciaTelefone}
                    onChange={e => setForm(f => ({ ...f, contactoEmergenciaTelefone: e.target.value }))}
                    placeholder="+244 900 000 000"
                  />
                </div>
              </div>
            </div>
          </div>
          <Button onClick={handleSave}>Guardar alterações</Button>
        </CardContent>
      </Card>

      
    </div>
  );
}
