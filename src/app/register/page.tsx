import type { Metadata } from "next";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Create an account — Glyph",
  description: "One account for your notes, on every browser you use.",
};

export default function RegisterPage() {
  return <AuthPanel mode="register" />;
}
