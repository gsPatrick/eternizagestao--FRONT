import { redirect } from "next/navigation";

/**
 * "Sepultamentos" deixou de ser uma tela.
 *
 * O cliente não distinguia o SEPULTADO (a pessoa) do SEPULTAMENTO (o ato de
 * sepultar) — eram, na prática dele, o mesmo cadastro. O fluxo foi unificado:
 * cadastrar o sepultado já o vincula à sepultura e emite a autorização.
 *
 * A rota permanece apenas para não quebrar links salvos/impressos: redireciona
 * para a lista de sepultados, que é onde a informação vive agora.
 */
export default function BurialsRedirect() {
  redirect("/painel/sepultados");
}
