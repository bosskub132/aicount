import { redirect } from "next/navigation";

export default function QueryTrayPage() {
  redirect("/documents?tab=query");
}
