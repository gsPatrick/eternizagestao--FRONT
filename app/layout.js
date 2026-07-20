import "./globals.css";

export const metadata = {
  title: "Eterniza Gestão",
  description: "Sistema de gestão de cemitérios — plataforma multi-cliente",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
