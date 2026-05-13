"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuperAdminPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/superadmin/users"); }, [router]);
  return null;
}
