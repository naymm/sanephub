export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: number;
          auth_user_id: string;
          nome: string;
          email: string;
          perfil: string;
          cargo: string;
          departamento: string;
          avatar: string;
          permissoes: string[];
          modulos: string[] | null;
          colaborador_id: number | null;
          empresa_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          auth_user_id: string;
          nome: string;
          email: string;
          perfil: string;
          cargo?: string;
          departamento?: string;
          avatar?: string;
          permissoes?: string[];
          modulos?: string[] | null;
          colaborador_id?: number | null;
          empresa_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          auth_user_id?: string;
          nome?: string;
          email?: string;
          perfil?: string;
          cargo?: string;
          departamento?: string;
          avatar?: string;
          permissoes?: string[];
          modulos?: string[] | null;
          colaborador_id?: number | null;
          empresa_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      bancos: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      contas_bancarias: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      aniversario_parabens: {
        Row: {
          id: number;
          empresa_id: number;
          destinatario_colaborador_id: number;
          autor_colaborador_id: number;
          mensagem: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          empresa_id: number;
          destinatario_colaborador_id: number;
          autor_colaborador_id: number;
          mensagem: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          empresa_id?: number;
          destinatario_colaborador_id?: number;
          autor_colaborador_id?: number;
          mensagem?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
