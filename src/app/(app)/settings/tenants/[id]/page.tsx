import Link from "next/link";

export default async function TenantSettingsDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const links = [
    { label: "COA", href: `/settings/tenants/${id}/coa` },
    { label: "Vendors", href: `/settings/tenants/${id}/vendors` },
    { label: "Customers", href: `/settings/tenants/${id}/customers` },
    { label: "Products", href: `/settings/tenants/${id}/products` },
    { label: "Departments", href: `/settings/tenants/${id}/departments` },
    { label: "Assignments", href: `/settings/tenants/${id}/assignments` },
    { label: "Period Locks", href: `/settings/tenants/${id}/period-locks` },
    { label: "Bank Recon", href: `/settings/tenants/${id}/bank-recon` },
    { label: "Tax Reports", href: `/settings/tenants/${id}/tax-reports` },
    { label: "Templates", href: `/settings/tenants/${id}/templates` },
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Tenant Settings</h1>
      <p className="text-slate-600">Use this area to navigate tenant-specific configuration pages.</p>
      <p className="text-sm text-slate-700">
        Tenant ID: <code>{id}</code>
      </p>
      <div className="grid max-w-2xl grid-cols-2 gap-2">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-100">
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

