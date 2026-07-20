"use client";

import { useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Checkbox from "@/components/atoms/Checkbox/Checkbox";
import Switch from "@/components/atoms/Switch/Switch";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Spinner from "@/components/atoms/Spinner/Spinner";

import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import Tabs from "@/components/molecules/Tabs/Tabs";
import Modal from "@/components/molecules/Modal/Modal";
import Pagination from "@/components/molecules/Pagination/Pagination";

import DataTable from "@/components/organisms/DataTable/DataTable";

const COLORS = [
  { name: "Navy", token: "--color-navy", hex: "#032e59", note: "Acento institucional" },
  { name: "Navy Deep", token: "--color-navy-deep", hex: "#02223f", note: "Hover / ênfase" },
  { name: "Ink", token: "--color-ink", hex: "#0e1c2f", note: "Texto principal" },
  { name: "Slate", token: "--color-slate", hex: "#5a6b80", note: "Texto secundário" },
  { name: "Mist", token: "--color-mist", hex: "#dde3eb", note: "Bordas" },
  { name: "Navy Soft", token: "--color-navy-soft", hex: "#e8eef6", note: "Fundos de destaque" },
  { name: "Canvas", token: "--color-canvas", hex: "#f4f6f9", note: "Fundo da aplicação" },
  { name: "Surface", token: "--color-surface", hex: "#ffffff", note: "Cartões e superfícies" },
];

const GRAVE_ROWS = [
  { id: 1, code: "A-R1-L1-001", type: "Jazigo", owner: "João da Silva", status: "livre", due: "—" },
  { id: 2, code: "A-R1-L1-002", type: "Cova", owner: "Maria Andrade", status: "ocupada", due: "R$ 150,00" },
  { id: 3, code: "A-R2-L3-014", type: "Gaveta", owner: "Carlos Pereira", status: "reservada", due: "R$ 320,00" },
  { id: 4, code: "B-R1-L2-007", type: "Jazigo", owner: "Ana Beatriz", status: "em_atraso", due: "R$ 890,00" },
];

const STATUS_BADGE = {
  livre: <Badge tone="success" dot>Livre</Badge>,
  ocupada: <Badge tone="navy" dot>Ocupada</Badge>,
  reservada: <Badge tone="warning" dot>Reservada</Badge>,
  em_atraso: <Badge tone="danger" dot>Em atraso</Badge>,
};

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [switched, setSwitched] = useState(true);
  const [page, setPage] = useState(3);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Eterniza Gestão · Fundamentos visuais</span>
          <h1 className={styles.heroTitle}>Design System</h1>
          <p className={styles.heroSub}>
            A linguagem visual da plataforma: sóbria, precisa e construída sobre uma única
            cor institucional. Cada componente abaixo é a base de tudo que virá.
          </p>
          <div className={styles.heroActions}>
            <Button size="lg">Começar agora</Button>
            <Button size="lg" variant="secondary">Ver documentação</Button>
          </div>
        </div>
        <div className={styles.heroGlow} aria-hidden="true" />
      </section>

      <div className={styles.container}>
        <Section number="01" title="Cores" lead="Uma cor institucional, dois planos de fundo. Tons funcionais aparecem apenas em status — nunca no chrome da interface.">
          <div className={styles.swatchGrid}>
            {COLORS.map((color) => (
              <div key={color.token} className={styles.swatch}>
                <span
                  className={styles.swatchColor}
                  style={{ background: color.hex, boxShadow: color.hex === "#ffffff" ? "inset 0 0 0 1px var(--color-mist)" : undefined }}
                />
                <div className={styles.swatchMeta}>
                  <strong>{color.name}</strong>
                  <code>{color.hex}</code>
                  <span>{color.note}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section number="02" title="Tipografia" lead="Fraunces para títulos — dignidade editorial. Inter para interface — legibilidade absoluta.">
          <div className={styles.typeCard}>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>Display · Fraunces 500</span>
              <span className={styles.typeDisplay}>Memória que permanece</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>Heading · Fraunces 500</span>
              <span className={styles.typeHeading}>Gestão completa do cemitério</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>Body · Inter 400 · 15px</span>
              <span className={styles.typeBody}>
                O sistema centraliza sepulturas, concessões, sepultamentos e cobranças em uma
                única plataforma — clara para quem administra, respeitosa para quem visita.
              </span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>Caption · Inter 600 · 13px</span>
              <span className={styles.typeCaption}>QUADRA A · RUA 1 · LOTE 3</span>
            </div>
          </div>
        </Section>

        <Section number="03" title="Botões" lead="Quatro variantes, três tamanhos. O primário carrega o navy com profundidade de gradiente — usado uma vez por contexto.">
          <div className={styles.demoCard}>
            <div className={styles.row}>
              <Button>Registrar sepultamento</Button>
              <Button variant="secondary">Exportar relatório</Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="danger">Excluir registro</Button>
            </div>
            <div className={styles.row}>
              <Button size="sm">Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
            </div>
            <div className={styles.row}>
              <Button loading>Salvando</Button>
              <Button variant="secondary" loading>Gerando boleto</Button>
              <Button disabled>Indisponível</Button>
              <Button
                variant="secondary"
                iconRight={
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                Próxima etapa
              </Button>
            </div>
          </div>
        </Section>

        <Section number="04" title="Formulários" lead="Campos com foco em anel navy, validação clara e hierarquia de rótulos consistente em todo o produto.">
          <div className={styles.demoCard}>
            <div className={styles.formGrid}>
              <FormField label="Nome completo" required htmlFor="ds-name">
                <Input id="ds-name" placeholder="Maria da Silva" />
              </FormField>
              <FormField label="CPF" hint="Somente números" htmlFor="ds-cpf">
                <Input id="ds-cpf" placeholder="000.000.000-00" />
              </FormField>
              <FormField label="Tipo de unidade" htmlFor="ds-type">
                <Select id="ds-type" defaultValue="jazigo">
                  <option value="cova">Cova</option>
                  <option value="jazigo">Jazigo</option>
                  <option value="gaveta">Gaveta</option>
                </Select>
              </FormField>
              <FormField label="E-mail" error="Informe um e-mail válido" htmlFor="ds-email">
                <Input id="ds-email" invalid defaultValue="maria@" />
              </FormField>
              <FormField
                label="Buscar sepultado"
                htmlFor="ds-search"
              >
                <Input
                  id="ds-search"
                  placeholder="Nome, CPF ou código do jazigo…"
                  iconLeft={
                    <svg viewBox="0 0 16 16" fill="none">
                      <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  }
                />
              </FormField>
              <FormField label="Campo desabilitado" htmlFor="ds-disabled">
                <Input id="ds-disabled" disabled value="Somente leitura" readOnly />
              </FormField>
            </div>
            <FormField label="Observações" hint="Visível apenas para a administração">
              <Textarea placeholder="Anotações internas sobre a concessão…" />
            </FormField>
            <div className={styles.row}>
              <Checkbox label="Notificar responsável por WhatsApp" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <Switch label="Concessão ativa" checked={switched} onChange={(e) => setSwitched(e.target.checked)} />
            </div>
          </div>
        </Section>

        <Section number="05" title="Status & Badges" lead="Os estados operacionais do negócio — sepulturas, cobranças e processos — sempre com a mesma gramática visual.">
          <div className={styles.demoCard}>
            <div className={styles.row}>
              <Badge tone="success" dot>Livre</Badge>
              <Badge tone="navy" dot>Ocupada</Badge>
              <Badge tone="warning" dot>Reservada</Badge>
              <Badge tone="neutral" dot>Em manutenção</Badge>
              <Badge tone="danger" dot>Interditada</Badge>
              <Badge tone="inverse">Em perpetuidade</Badge>
            </div>
            <div className={styles.row}>
              <Badge tone="success">Pago</Badge>
              <Badge tone="warning">Pendente</Badge>
              <Badge tone="danger">Em atraso</Badge>
              <Badge tone="neutral">Cancelado</Badge>
              <span className={styles.inlineDemo}>
                <Avatar name="João da Silva" size="sm" />
                <Avatar name="Maria Andrade" size="md" />
                <Avatar name="Ana Beatriz" size="lg" />
              </span>
              <span className={styles.inlineDemo}>
                <Spinner size={14} />
                <Spinner size={18} />
              </span>
            </div>
          </div>
        </Section>

        <Section number="06" title="Indicadores" lead="Cartões de métrica do painel — número em display, contexto em caption, variação contida.">
          <div className={styles.statGrid}>
            <StatCard label="Jazigos ocupados" value="1.284" delta="4,2%" caption="vs. mês anterior" />
            <StatCard label="Arrecadação do mês" value="R$ 84,3 mil" delta="12,8%" caption="até hoje" />
            <StatCard label="Inadimplência" value="6,4%" delta="1,1%" deltaTone="danger" caption="93 cobranças" />
            <StatCard label="Sepultamentos" value="37" caption="últimos 30 dias" />
          </div>
        </Section>

        <Section number="07" title="Tabela de dados" lead="Densidade equilibrada, cabeçalho discreto, hover sutil — pronta para listas de sepulturas, cobranças e concessões.">
          <DataTable
            caption="Sepulturas · Cemitério Municipal"
            columns={[
              { key: "code", label: "Código", render: (row) => <code className={styles.code}>{row.code}</code> },
              { key: "type", label: "Tipo" },
              { key: "owner", label: "Concessionário", render: (row) => (
                <span className={styles.ownerCell}>
                  <Avatar name={row.owner} size="sm" />
                  {row.owner}
                </span>
              ) },
              { key: "status", label: "Situação", render: (row) => STATUS_BADGE[row.status] },
              { key: "due", label: "Débitos", align: "right" },
              { key: "actions", label: "", align: "right", render: () => (
                <Button size="sm" variant="ghost">Detalhes</Button>
              ) },
            ]}
            rows={GRAVE_ROWS}
            footer={
              <>
                <span>Mostrando 4 de 128 registros</span>
                <Pagination page={page} totalPages={32} onChange={setPage} />
              </>
            }
          />
        </Section>

        <Section number="08" title="Navegação por abas" lead="Segmentação de conteúdo dentro de uma mesma página — visão 360º do jazigo, por exemplo.">
          <div className={styles.demoCard}>
            <Tabs
              items={[
                {
                  label: "Visão geral",
                  content: <p className={styles.tabText}>Resumo do jazigo: concessão vigente, ocupação e localização no mapa.</p>,
                },
                {
                  label: "Sepultados",
                  count: 3,
                  content: <p className={styles.tabText}>Lista de sepultados vinculados a esta unidade, com histórico completo.</p>,
                },
                {
                  label: "Financeiro",
                  count: 2,
                  content: <p className={styles.tabText}>Taxas de manutenção, cobranças emitidas e recibos de pagamento.</p>,
                },
                {
                  label: "Linha do tempo",
                  content: <p className={styles.tabText}>Todos os eventos da sepultura em ordem cronológica — imutável.</p>,
                },
              ]}
            />
          </div>
        </Section>

        <Section number="09" title="Feedback" lead="Alertas com tom contido — informam sem gritar. O vermelho existe, mas é raro.">
          <div className={styles.alertStack}>
            <Alert tone="info" title="Sincronização concluída">128 cobranças geradas para a competência 08/2026.</Alert>
            <Alert tone="success" title="Pagamento confirmado">Baixa automática realizada e recibo nº 0042/2026 emitido.</Alert>
            <Alert tone="warning" title="Concessão próxima do vencimento">O contrato A-R1-L1-002 vence em 30 dias.</Alert>
            <Alert tone="danger" title="Jazigo bloqueado por inadimplência">Novas operações estão suspensas até a regularização dos débitos.</Alert>
          </div>
        </Section>

        <Section number="10" title="Modal" lead="Sobreposição com desfoque, entrada cinematográfica e rodapé de ações padronizado.">
          <div className={styles.demoCard}>
            <div className={styles.row}>
              <Button onClick={() => setModalOpen(true)}>Abrir modal de exemplo</Button>
            </div>
          </div>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Registrar sepultamento"
            subtitle="Jazigo A-R1-L1-001 · Cemitério Municipal"
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={() => setModalOpen(false)}>Confirmar registro</Button>
              </>
            }
          >
            <div className={styles.modalForm}>
              <FormField label="Sepultado" required>
                <Input placeholder="Buscar por nome ou CPF…" />
              </FormField>
              <FormField label="Data do sepultamento" required>
                <Input type="date" defaultValue="2026-07-16" />
              </FormField>
              <Alert tone="info">A situação do jazigo será atualizada automaticamente para “Ocupada”.</Alert>
            </div>
          </Modal>
        </Section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>Eterniza Gestão</span>
          <span className={styles.footerNote}>Design System · v1 · #032e59 sobre branco e cinza</span>
        </div>
      </footer>
    </main>
  );
}

function Section({ number, title, lead, children }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionNumber}>{number}</span>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionLead}>{lead}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
