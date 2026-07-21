"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import PortalShell from "@/components/organisms/PortalShell/PortalShell";
import Badge from "@/components/atoms/Badge/Badge";
import Button from "@/components/atoms/Button/Button";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import { useTenant } from "@/components/providers/TenantTheme/TenantTheme";
import { useResource, useMutation } from "@/lib/api/useResource";
import { getBillings, reissueBilling, billTotal, formatBRL } from "@/lib/api/resources/portal";

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "aberto", label: "Em aberto" },
  { key: "vencidas", label: "Vencidas" },
  { key: "pagas", label: "Pagas" },
];

function matchesFilter(bill, filter) {
  if (filter === "todas") return true;
  if (filter === "aberto") return bill.status === "vencido" || bill.status === "a_vencer";
  if (filter === "vencidas") return bill.status === "vencido";
  if (filter === "pagas") return bill.status === "pago";
  return true;
}

function statusBadge(status) {
  if (status === "vencido") return <Badge tone="danger" dot>Vencida</Badge>;
  if (status === "a_vencer") return <Badge tone="warning" dot>A vencer</Badge>;
  return <Badge tone="success" dot>Paga</Badge>;
}

export default function PortalCobrancasPage() {
  const tenant = useTenant();
  const sub = (tenant?.subdomain || "").split(".")[0];

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => getBillings({ signal, tenant: sub }),
    [sub]
  );
  const billings = data ?? [];

  const [filter, setFilter] = useState("todas");
  const [activeBill, setActiveBill] = useState(null);
  const [method, setMethod] = useState("pix");
  const [copied, setCopied] = useState(null);
  const [payment, setPayment] = useState(null);

  const reissue = useMutation((id) => reissueBilling(id, { tenant: sub }));

  const open = billings.filter((b) => b.status === "vencido" || b.status === "a_vencer");
  const overdue = billings.filter((b) => b.status === "vencido");
  const upcoming = billings.filter((b) => b.status === "a_vencer");
  const paid = billings.filter((b) => b.status === "pago");

  const totalOpen = open.reduce((sum, b) => sum + billTotal(b), 0);

  const counts = {
    todas: billings.length,
    aberto: open.length,
    vencidas: overdue.length,
    pagas: paid.length,
  };

  const filtered = useMemo(
    () => billings.filter((b) => matchesFilter(b, filter)),
    [billings, filter]
  );

  const allPaid = open.length === 0;

  async function openModal(bill) {
    setActiveBill(bill);
    setMethod("pix");
    setCopied(null);
    setPayment(null);
    try {
      const result = await reissue.mutate(bill.id);
      setPayment(result);
      refetch();
    } catch (e) {
      // reissue.error já carrega a mensagem amigável — a modal exibe o erro
    }
  }

  function closeModal() {
    setActiveBill(null);
    setCopied(null);
    setPayment(null);
  }

  async function copy(text, which) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // clipboard indisponível — segue com o feedback visual mesmo assim
    }
    setCopied(which);
    window.setTimeout(() => setCopied((cur) => (cur === which ? null : cur)), 2000);
  }

  return (
    <PortalShell active="cobrancas">
      <div className={styles.page}>
        <header className={styles.hero}>
          <h1 className={styles.title}>Cobranças</h1>
          <p className={styles.subtitle}>
            Emita a 2ª via e pague por PIX ou boleto quando quiser.
          </p>
        </header>

        {loading ? (
          <Skeleton variant="card" count={4} height={96} />
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : billings.length === 0 ? (
          <EmptyState
            title="Nenhuma cobrança por aqui"
            message="Você não tem cobranças registradas no momento. Agradecemos o cuidado."
          />
        ) : (
          <>
            {/* resumo */}
            <section className={styles.summary}>
              <div className={`${styles.summaryCard} ${styles.summaryPrimary}`}>
                <span className={styles.summaryLabel}>Total em aberto</span>
                <strong className={styles.summaryValue}>{formatBRL(totalOpen)}</strong>
                <span className={styles.summaryMeta}>{open.length} cobrança(s)</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Vencidas</span>
                <strong className={styles.summaryValue}>{overdue.length}</strong>
                <span className={styles.summaryMeta}>com multa e juros</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>A vencer</span>
                <strong className={styles.summaryValue}>{upcoming.length}</strong>
                <span className={styles.summaryMeta}>próximas</span>
              </div>
            </section>

            {/* filtros */}
            <div className={styles.chips} role="tablist" aria-label="Filtrar cobranças">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`${styles.chip} ${filter === f.key ? styles.chipActive : ""}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <span className={styles.chipCount}>{counts[f.key]}</span>
                </button>
              ))}
            </div>

            {/* estado vazio gentil */}
            {allPaid && filter !== "pagas" && (
              <Alert tone="success" title="Você está em dia">
                Nenhuma cobrança em aberto no momento. Agradecemos o cuidado.
              </Alert>
            )}

            {/* lista */}
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.4l2.3 2.3 4.6-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className={styles.emptyText}>Nenhuma cobrança neste filtro.</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {filtered.map((bill) => {
                  const isOverdue = bill.status === "vencido";
                  const isPaid = bill.status === "pago";
                  return (
                    <li
                      key={bill.id}
                      className={`${styles.card} ${isPaid ? styles.cardPaid : ""}`}
                    >
                      <div className={styles.cardHead}>
                        <div className={styles.cardInfo}>
                          <strong className={styles.cardTitle}>{bill.description}</strong>
                          <span className={styles.cardGrave}>{bill.grave}</span>
                        </div>
                        {statusBadge(bill.status)}
                      </div>

                      <div className={styles.cardMeta}>
                        {isPaid ? (
                          <span className={styles.metaItem}>Pago em {bill.paidAt}</span>
                        ) : (
                          <span className={styles.metaItem}>Vencimento {bill.due}</span>
                        )}
                        {isOverdue && (
                          <span className={`${styles.metaItem} ${styles.metaOverdue}`}>
                            há {bill.days} dias
                          </span>
                        )}
                      </div>

                      <div className={styles.cardFoot}>
                        <div className={styles.amountBox}>
                          <span className={styles.amount}>{formatBRL(billTotal(bill))}</span>
                          {isOverdue && (bill.fine > 0 || bill.interest > 0) && (
                            <span className={styles.amountExtra}>
                              inclui {formatBRL(bill.fine + bill.interest)} de multa e juros
                            </span>
                          )}
                        </div>
                        {!isPaid && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openModal(bill)}
                            iconLeft={
                              <svg viewBox="0 0 16 16" fill="none">
                                <rect x="2" y="3.5" width="12" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.4" />
                              </svg>
                            }
                          >
                            Gerar 2ª via
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {/* MODAL DE 2ª VIA */}
      <Modal
        open={!!activeBill}
        onClose={closeModal}
        title="Segunda via de pagamento"
        subtitle={activeBill ? `${activeBill.description} · ${activeBill.grave}` : ""}
        width={480}
        footer={
          <Button variant="ghost" size="md" onClick={closeModal}>
            Fechar
          </Button>
        }
      >
        {activeBill && (
          <div className={styles.modal}>
            <div className={styles.billSummary}>
              <div className={styles.billRow}>
                <span className={styles.billKey}>Vencimento</span>
                <span className={styles.billVal}>{activeBill.due}</span>
              </div>
              <div className={styles.billRow}>
                <span className={styles.billKey}>Valor total</span>
                <span className={styles.billTotal}>{formatBRL(billTotal(activeBill))}</span>
              </div>
            </div>

            {reissue.loading ? (
              <div className={styles.pane}>
                <Skeleton variant="block" height={140} />
                <p className={styles.paneHint}>Gerando a 2ª via…</p>
              </div>
            ) : reissue.error ? (
              <ErrorState
                title="Não foi possível gerar a 2ª via"
                message={reissue.error.message}
                onRetry={() => openModal(activeBill)}
              />
            ) : (
              <>
                <div className={styles.toggle} role="tablist" aria-label="Forma de pagamento">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={method === "pix"}
                    className={`${styles.toggleBtn} ${method === "pix" ? styles.toggleActive : ""}`}
                    onClick={() => setMethod("pix")}
                  >
                    PIX
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={method === "boleto"}
                    className={`${styles.toggleBtn} ${method === "boleto" ? styles.toggleActive : ""}`}
                    onClick={() => setMethod("boleto")}
                  >
                    Boleto
                  </button>
                </div>

                {method === "pix" ? (
                  !payment?.pixCode ? (
                    // Sem PIX emitido pelo gateway: não há QR nem código para
                    // mostrar. Dizemos a verdade em vez de exibir um QR vazio.
                    <div className={styles.pane}>
                      <Alert tone="info" title="PIX ainda não disponível">
                        Esta cobrança ainda não teve o PIX emitido pela prefeitura.
                        Procure a administração do cemitério para pagar ou aguarde
                        o aviso de emissão — nada é perdido enquanto isso.
                      </Alert>
                    </div>
                  ) : (
                  <div className={styles.pane}>
                    {payment.pixQrImage ? (
                      <div className={styles.qrWrap}>
                        {/* QR REAL emitido pelo gateway. Antes havia aqui um SVG
                            desenhado à mão, decorativo: quem escaneasse não pagava. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className={styles.qr}
                          src={payment.pixQrImage}
                          alt="QR Code do PIX desta cobrança"
                        />
                      </div>
                    ) : null}
                    <p className={styles.paneHint}>
                      {payment.pixQrImage
                        ? "Abra o app do seu banco, escolha pagar com PIX e leia o QR Code, ou copie o código abaixo."
                        : "Abra o app do seu banco, escolha pagar com PIX e cole o código abaixo."}
                    </p>
                    <div className={styles.codeBox}>
                      <code className={styles.code}>{payment?.pixCode}</code>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      full
                      disabled={!payment?.pixCode}
                      onClick={() => copy(payment.pixCode, "pix")}
                      iconLeft={
                        <svg viewBox="0 0 16 16" fill="none">
                          <rect x="5" y="5" width="8" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M3 11V3.4A1.4 1.4 0 0 1 4.4 2H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      }
                    >
                      {copied === "pix" ? "Copiado!" : "Copiar código PIX"}
                    </Button>
                  </div>
                  )
                ) : !payment?.boletoLine && !payment?.boletoUrl ? (
                  // Boleto não emitido (ex.: gateway de pagamento ainda não
                  // configurado pela prefeitura). Estado legítimo e comum — o
                  // cidadão precisa saber disso, e não receber uma promessa de
                  // download que nunca acontece.
                  <div className={styles.pane}>
                    <Alert tone="info" title="Boleto ainda não emitido">
                      A prefeitura ainda não emitiu o boleto desta cobrança.
                      Assim que for emitido, a linha digitável e o PDF aparecem
                      aqui. Você também pode pagar presencialmente na
                      administração do cemitério.
                    </Alert>
                  </div>
                ) : (
                  <div className={styles.pane}>
                    <p className={styles.paneHint}>
                      {payment?.boletoLine
                        ? "Use a linha digitável abaixo no app do seu banco ou baixe o boleto em PDF."
                        : "Baixe o boleto em PDF para pagar no app do seu banco ou em uma agência."}
                    </p>
                    {payment?.boletoLine && (
                      <>
                    <div className={styles.codeBox}>
                      <code className={styles.code}>{payment.boletoLine}</code>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      full
                      onClick={() => copy(payment.boletoLine, "boleto")}
                      iconLeft={
                        <svg viewBox="0 0 16 16" fill="none">
                          <rect x="5" y="5" width="8" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M3 11V3.4A1.4 1.4 0 0 1 4.4 2H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      }
                    >
                      {copied === "boleto" ? "Copiado!" : "Copiar linha digitável"}
                    </Button>
                      </>
                    )}
                    {/* PDF só é oferecido quando existe URL real do boleto —
                        sem URL o botão simplesmente não aparece. */}
                    {payment?.boletoUrl && (
                    <Button
                      variant="secondary"
                      size="md"
                      full
                      onClick={() => window.open(payment.boletoUrl, "_blank", "noopener")}
                      iconLeft={
                        <svg viewBox="0 0 16 16" fill="none">
                          <path d="M8 2v8m0 0L5 7m3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      }
                    >
                      Baixar boleto (PDF)
                    </Button>
                    )}
                  </div>
                )}

                {/* a promessa de baixa automática só vale se existe algum meio
                    de pagamento emitido — sem isso não há o que confirmar */}
                {(payment?.pixCode || payment?.boletoLine || payment?.boletoUrl) && (
                  <p className={styles.reassure}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M5.4 8.2l1.8 1.8 3.4-3.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    O pagamento é confirmado automaticamente em alguns minutos.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </PortalShell>
  );
}
