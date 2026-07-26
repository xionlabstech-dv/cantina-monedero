import { AdminNav } from "@/components/AdminNav";

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <AdminNav />
      <div className="flex-1 px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
