"use client";

import PeopleView from "../pessoas/PeopleView";

// View sobre Pessoas escopada ao papel "proprietário" — sem duplicar cadastro:
// reusa o mesmo componente/resource, apenas fixando o papel na listagem.
export default function OwnersPage() {
  return (
    <PeopleView
      initialRole="proprietario"
      roleLocked
      title="Proprietários"
      subtitle="Pessoas que respondem por jazigos como titulares de concessão"
      emptyTitle="Nenhum proprietário cadastrado"
      emptyMessage="Proprietários aparecem aqui quando têm uma concessão vinculada. Cadastre a pessoa e vincule-a a uma concessão."
    />
  );
}
