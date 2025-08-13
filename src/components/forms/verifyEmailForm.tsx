"use client";
import { useState } from "react";

export function VerifyEmailForm({ email }: { email: string }) {
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/confirm-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });

    if (res.ok) {
      alert("Email vérifié ! Vous pouvez maintenant vous connecter.");
    } else {
      alert("Code invalide !");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code de vérification"
      />
      <button type="submit">Vérifier</button>
    </form>
  );
}