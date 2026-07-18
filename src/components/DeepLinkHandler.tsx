"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/components/SessionProvider";
import { useToast } from "@/hooks/use-toast";
import { useAppMode, LOCAL_ONLY_KEY } from "@/hooks/use-app-mode";

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
  const { toast } = useToast();
  const { localOnly } = useAppMode();
  const [isVerifying, setIsVerifying] = useState(false);
  const mountedRef = useRef(false);
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Source de vérité live : on lit le flag depuis localStorage au moment du
  // callback deep link plutôt que de capturer `localOnly` figé au montage.
  // Sinon, un toggle "Locale uniquement" effectué après le montage laisserait
  // la fermeture périmée et autoriserait un transfert cloud interdit.
  const isLocalOnlyLive = useCallback(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(LOCAL_ONLY_KEY) === "1";
    } catch {
      return localOnly;
    }
  }, [localOnly]);

  const resetVerifying = useCallback(() => {
    if (verifyTimeoutRef.current) {
      clearTimeout(verifyTimeoutRef.current);
      verifyTimeoutRef.current = null;
    }
    setIsVerifying(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
        verifyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) {
      return;
    }

    let cancelled = false;

    import("@tauri-apps/plugin-deep-link")
      .then((deepLink) => {
        if (cancelled) return;

        const unsubscribe = deepLink.onOpenUrl(async (urls) => {
          if (!mountedRef.current) return;

          const url = urls[0];
          if (!url) return;
          if (!(url.startsWith("visionode://auth") || url.startsWith("visionode://login"))) {
            return;
          }

          // Mode Locale uniquement : on refuse tout transfert de session cloud
          // via deep link (cela contournerait le mode Locale). Lecture live du
          // flag pour ne pas utiliser une valeur figée au montage du composant.
          if (isLocalOnlyLive()) {
            console.warn("[DEEPLINK] Transfert cloud refusé : mode Locale uniquement actif.");
            if (mountedRef.current) {
              toast({
                variant: "destructive",
                title: "Mode Locale uniquement",
                description: "Connexion cloud désactivée. Transfert de session refusé.",
              });
            }
            return;
          }

          setIsVerifying(true);
          // Sécurité : évite un overlay de chargement bloqué indéfiniment
          // si la vérification reste sans réponse (réseau coupé, etc.).
          verifyTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) setIsVerifying(false);
          }, 15000);

          try {
            const urlObj = new URL(url);
            const token = urlObj.searchParams.get("token");
            if (!token) {
              if (mountedRef.current) resetVerifying();
              return;
            }

            const res = await apiClient.post<VerifyMagicLinkResponse>(
              "/api/auth/verify-magic-link",
              { token },
            );

            if (verifyTimeoutRef.current) {
              clearTimeout(verifyTimeoutRef.current);
              verifyTimeoutRef.current = null;
            }

            if (mountedRef.current && res.success && res.user) {
              login(res.user as any, { source: "cloud" });
              router.replace("/dashboard");
            } else if (mountedRef.current) {
              console.error("Échec de la validation du lien de transfert :", res.error);
              toast({
                variant: "destructive",
                title: "Échec de l'authentification",
                description: res.error || "Le lien de connexion est invalide ou expiré.",
              });
              setIsVerifying(false);
            }
          } catch (e) {
            if (verifyTimeoutRef.current) {
              clearTimeout(verifyTimeoutRef.current);
              verifyTimeoutRef.current = null;
            }
            if (mountedRef.current) {
              console.error("Token invalide ou corrompu", e);
              toast({
                variant: "destructive",
                title: "Erreur d'authentification",
                description: "Impossible de valider le lien de connexion.",
              });
              setIsVerifying(false);
            }
          }
        });

        if (typeof unsubscribe === "function") {
          listenerCleanupRef.current = unsubscribe;
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("Deep link plugin load failed:", err);
      });

    return () => {
      cancelled = true;
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }
    };
  }, []);

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
