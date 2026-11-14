import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { requireUser } from "@/lib/auth";
import { MaterialForm } from "../material-form";

export default function NewMaterialPage() {
  return (
    <>
      <PageHeader title="Tambah Material" />
      <Suspense fallback={<Skeleton rows={6} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireUser("admin");
  return (
    <MaterialForm
      initial={{
        id: null,
        name: "",
        sku: null,
        code: null,
        category: "lainnya",
        unit: "pcs",
        minPurchase: 1,
        price: 0,
        usagePerPoint: 1,
        glassDeduction: 0,
        intersectionCutback: 0,
        note: null,
        active: true,
      }}
    />
  );
}
