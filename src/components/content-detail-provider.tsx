import { createContext, useContext, useState, type ReactNode } from "react";
import { ContentItemDetail } from "@/components/content-item-detail";

interface Ctx { open: (id: string) => void; close: () => void; }
const C = createContext<Ctx | undefined>(undefined);

export function ContentDetailProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <C.Provider value={{ open: setOpenId, close: () => setOpenId(null) }}>
      {children}
      {openId && (
        <ContentItemDetail itemId={openId} open={true} onOpenChange={(o: boolean) => !o && setOpenId(null)} />
      )}
    </C.Provider>
  );
}

export function useContentDetail() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useContentDetail must be used inside ContentDetailProvider");
  return ctx;
}
