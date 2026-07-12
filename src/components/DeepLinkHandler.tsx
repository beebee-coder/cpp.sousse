"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/components/SessionProvider";

interface VerifyMagicLinkResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
    firstName?: string | null;
    lastName?: string | null;
    image?: string | null;
  };
  error?: string;
}

export function DeepLinkHandler() {
  const router = useRouter();
  const { login } = useSession();
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Vérifier si on est dans l'environnement Tauri
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      import("@tauri-apps/plugin-deep-link")
        .then((deepLink) => {
          deepLink
            .onOpenUrl(async (urls) => {
              const url = urls[0];
              if (!url) return;
              // Accepter visionode://auth (web) et visionode://login (legacy).
              if (!(url.startsWith("visionode://auth") || url.startsWith("visionode://login"))) {
                return;
              }

              setIsVerifying(true);
              try {
                const urlObj = new URL(url);
                const token = urlObj.searchParams.get("token");
                if (!token) {
                  setIsVerifying(false);
                  return;
                }

                // Le desktop n'a pas d'API locale : on délègue la vérification
                // (et la validation du JWT signé) au backend cloud.
                const res = await apiClient.post<VerifyMagicLinkResponse>(
                  "/api/auth/verify-magic-link",
                  { token },
                );

                if (res.success && res.user) {
                  // Adoption de l'identité cloud (même compte, aucune saisie).
                  login(res.user as any);
                  router.replace("/dashboard");
                } else {
                  console.error("Échec de la validation du lien de transfert :", res.error);
                  setIsVerifying(false);
                }
              } catch (e) {
                console.error("Token invalide ou corrompu", e);
                setIsVerifying(false);
              }
            })
            .catch(console.error);
        })
        .catch(console.error);
    }
  }, [router, login]);

  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold font-headline uppercase tracking-widest text-primary">Authentification en cours</h2>
        <p className="text-sm text-muted-foreground font-code mt-2">Synchronisation des identifiants...</p>
      </div>
    );
  }

  return null;
}
