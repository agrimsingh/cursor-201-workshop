import { Suspense } from "react";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { PageHeader } from "@/components/ui/page-header";

export default function InvoicesPage() {
  return (
    <>
      <PageHeader title="Invoices" description="Every invoice across all customers and currencies." />
      <Suspense>
        <InvoiceList />
      </Suspense>
    </>
  );
}
