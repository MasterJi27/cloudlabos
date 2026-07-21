"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewWorkflowPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workflows?new=1");
  }, [router]);
  return null;
}