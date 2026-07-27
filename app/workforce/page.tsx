import { redirect } from "next/navigation";

/** `/workforce` is a convenience entry that lands on the application. */
export default function WorkforceIndexPage() {
  redirect("/workforce/apply");
}
