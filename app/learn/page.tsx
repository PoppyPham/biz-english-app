import { redirect } from "next/navigation"

// The category browser used to live at /learn as its own page, duplicating
// most of the Home page. It's now merged into the Learning Dashboard at "/".
// This redirect keeps old links/bookmarks working.
export default function LearnPage() {
  redirect("/")
}
