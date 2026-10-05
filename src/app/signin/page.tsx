import type { Metadata } from "next";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Sign in — Glyph",
  description: "Open the notes you left in the cloud.",
};

export default function SignInPage() {
  return <AuthPanel mode="signin" />;
}
