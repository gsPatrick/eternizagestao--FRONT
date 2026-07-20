import { redirect } from "next/navigation";

// O HUB de Configurações abre sempre no primeiro tópico (Identidade visual).
// A navegação entre tópicos é feita pela sidebar interna do layout.
export default function ConfiguracoesPage() {
  redirect("/painel/configuracoes/identidade");
}
