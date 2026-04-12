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
          username: string;
          perfil: string;
          cargo: string;
          departamento: string;
          avatar: string;
          permissoes: string[];
          modulos: string[] | null;
          colaborador_id: number | null;
          empresa_id: number | null;
          numero_mec?: string | null;
          /** Nunca pedir em select público; só RPC bcrypt. */
          ponto_pin_hash?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          auth_user_id: string;
          nome: string;
          email: string;
          username: string;
          perfil: string;
          cargo?: string;
          departamento?: string;
          avatar?: string;
          permissoes?: string[];
          modulos?: string[] | null;
          colaborador_id?: number | null;
          empresa_id?: number | null;
          numero_mec?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          auth_user_id?: string;
          nome?: string;
          email?: string;
          username?: string;
          perfil?: string;
          cargo?: string;
          departamento?: string;
          avatar?: string;
          permissoes?: string[];
          modulos?: string[] | null;
          colaborador_id?: number | null;
          empresa_id?: number | null;
          numero_mec?: string | null;
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
      intranet_chat_conversations: {
        Row: {
          id: string;
          type: string;
          name: string | null;
          participant_ids: number[];
          created_by_profile_id: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          name?: string | null;
          participant_ids: number[];
          created_by_profile_id: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          name?: string | null;
          participant_ids?: number[];
          created_by_profile_id?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      geofences: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      colaborador_geofences: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      intranet_chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_profile_id: number;
          content: string;
          attachments: Json;
          read_by_profile_ids: number[];
          pinned: boolean;
          pinned_at: string | null;
          pinned_by_profile_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_profile_id: number;
          content: string;
          attachments?: Json;
          read_by_profile_ids?: number[];
          pinned?: boolean;
          pinned_at?: string | null;
          pinned_by_profile_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_profile_id?: number;
          content?: string;
          attachments?: Json;
          read_by_profile_ids?: number[];
          pinned?: boolean;
          pinned_at?: string | null;
          pinned_by_profile_id?: number | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      intranet_chat_mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      intranet_chat_latest_messages: {
        Args: { p_conversation_ids: string[] };
        Returns: {
          id: string;
          conversation_id: string;
          sender_profile_id: number;
          content: string;
          attachments: Json;
          read_by_profile_ids: number[];
          pinned: boolean;
          pinned_at: string | null;
          pinned_by_profile_id: number | null;
          created_at: string;
        }[];
      };
      intranet_chat_unread_summary: {
        Args: Record<string, never>;
        Returns: { conversation_id: string; unread_count: number }[];
      };
      resolve_login_email: {
        Args: { p_username: string };
        Returns: string | null;
      };
      perfil_tem_ponto_pin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      definir_meu_ponto_pin: {
        Args: { pin_plain: string };
        Returns: undefined;
      };
      alterar_meu_ponto_pin: {
        Args: { pin_atual: string; pin_novo: string };
        Returns: undefined;
      };
      verificar_meu_ponto_pin: {
        Args: { pin_plain: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
