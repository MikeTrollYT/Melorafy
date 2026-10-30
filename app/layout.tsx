import "./globals.css";
export const metadata = {
  title: "Melorafy",
  description: "Lo que estoy escuchando ahora mismo",
  icons: {
    icon: "/img/logo.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
