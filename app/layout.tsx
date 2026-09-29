
import type { ReactNode } from "react";

export const metadata = {
  title: "Hjertstedt Family Hub",
  description: "Familjens digitala nav",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="sv">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
