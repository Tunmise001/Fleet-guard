import { redirect } from "next/navigation";

// `/live` was a byte-for-byte duplicate of `/`. Kept as a redirect so existing
// demo links do not break.
export default function LivePage() {
  redirect("/");
}
