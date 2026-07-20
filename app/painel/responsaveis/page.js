"use client";

import PeopleView from "../pessoas/PeopleView";

// View sobre Pessoas escopada ao papel "responsável" — sem duplicar cadastro:
// reusa o mesmo componente/resource, apenas fixando o papel na listagem.
export default function ResponsiblesPage() {
  return (
    <PeopleView
      initialRole="responsavel"
      roleLocked
      title="Responsáveis"
      subtitle="Pessoas responsáveis por jazigos, sepultamentos e manutenções"
      emptyTitle="Nenhum responsável cadastrado"
      emptyMessage="Responsáveis aparecem aqui quando são vinculados a um jazigo ou sepultamento."
    />
  );
}
