"use client";
import TutorPanel from "./TutorPanel";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TutorPanel />
    </>
  );
}
