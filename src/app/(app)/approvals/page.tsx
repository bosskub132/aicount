import { redirect } from "next/navigation";

export default function ApprovalsPage() {
  redirect("/documents?tab=pending");
}
