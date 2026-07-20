import PlatformLanding from "@/components/templates/PlatformLanding/PlatformLanding";

/**
 * /plataforma — landing INSTITUCIONAL da Eterniza (a LP que o dono usa pra
 * vender o sistema para prefeituras). É a rota canônica desse conteúdo; a
 * raiz `/` cai aqui quando não há subdomínio de cidade.
 */
export default function PlataformaPage() {
  return <PlatformLanding />;
}
