import "./globals.css";
export const metadata = { title: "For You · Maps", description: "Personalised restaurant recommendations" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
