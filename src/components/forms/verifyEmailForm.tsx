"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function VerifyEmailForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/confirm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        toast.success("Email vérifié ✅", {
          description: "Vous pouvez maintenant vous connecter.",
        });
        router.push("/"); // redirection après succès
      } else {
        toast.error("Erreur ❌", {
          description: "Code invalide !",
        });
      }
    } catch (error) {
      toast.error("Erreur serveur", {
        description: "Veuillez réessayer plus tard.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);

    try {
      const res = await fetch("/api/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        toast.success("Nouveau code envoyé 📩", {
          description: "Vérifiez votre boîte mail.",
        });
      } else {
        toast.error("Erreur ❌", {
          description: "Impossible de renvoyer le code.",
        });
      }
    } catch (error) {
      toast.error("Erreur serveur", {
        description: "Veuillez réessayer plus tard.",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code de vérification"
        className="border rounded px-3 py-2 w-full"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Vérification..." : "Vérifier"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="bg-gray-200 text-gray-700 px-4 py-2 rounded w-full"
      >
        {resending ? "Renvoi en cours..." : "Renvoyer le code"}
      </button>
    </form>
  );
}
