// StoreKit (iOS) via cordova-plugin-purchase. Em Android/Web cai em Paddle.
import { Capacitor } from "@capacitor/core";
import { creditIapGems } from "@/lib/iap.functions";

// Mapeia ID do pack interno -> product ID do StoreKit
export const IOS_PRODUCT_IDS: Record<string, string> = {
  starter: "com.arenapet.gems.50",
  pro: "com.arenapet.gems.150",
  epic: "com.arenapet.gems.400",
  legend: "com.arenapet.gems.1000",
};

export function isIos(): boolean {
  try {
    return Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    CdvPurchase?: any;
  }
}

let storeReady: Promise<any> | null = null;

function getStore() {
  const CdvPurchase = window.CdvPurchase;
  if (!CdvPurchase) throw new Error("Plugin de compras não disponível");
  return CdvPurchase.store;
}

async function initStore(): Promise<any> {
  if (storeReady) return storeReady;
  storeReady = (async () => {
    // Aguarda o plugin Cordova ficar pronto
    if (!window.CdvPurchase) {
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const i = setInterval(() => {
          if (window.CdvPurchase || Date.now() - start > 5000) {
            clearInterval(i);
            resolve();
          }
        }, 100);
      });
    }
    const { store, ProductType, Platform } = window.CdvPurchase;
    if (!store) throw new Error("StoreKit indisponível");

    // Registra todos os produtos (apenas uma vez)
    const products = Object.values(IOS_PRODUCT_IDS).map((id) => ({
      id,
      type: ProductType.CONSUMABLE,
      platform: Platform.APPLE_APPSTORE,
    }));
    store.register(products);

    await store.initialize([Platform.APPLE_APPSTORE]);
    return store;
  })();
  return storeReady;
}

/**
 * Compra um pack via StoreKit no iOS.
 * Retorna `{ credited: true, gems }` quando o servidor confirma o crédito.
 */
export async function purchaseIosGemsPack(packId: string): Promise<{ credited: boolean; gems: number }> {
  const productId = IOS_PRODUCT_IDS[packId];
  if (!productId) throw new Error("Pacote indisponível no iOS");

  const store = await initStore();
  const product = store.get(productId);
  if (!product) throw new Error("Produto não encontrado no StoreKit");
  const offer = product.getOffer();
  if (!offer) throw new Error("Oferta indisponível");

  return await new Promise<{ credited: boolean; gems: number }>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    store
      .when()
      .approved(async (transaction: any) => {
        try {
          // Valida e credita no servidor (idempotente por transactionId)
          const txId = transaction.transactionId || transaction.id;
          const res = await creditIapGems({
            data: {
              productId,
              transactionId: String(txId),
              platform: "ios",
            },
          });
          // Finaliza no StoreKit só depois que o servidor confirmou
          await transaction.finish();
          done(() => resolve({ credited: true, gems: res.gems ?? 0 }));
        } catch (e) {
          done(() => reject(e instanceof Error ? e : new Error(String(e))));
        }
      })
      .cancelled(() => {
        done(() => reject(new Error("Compra cancelada")));
      })
      .error((err: any) => {
        done(() => reject(new Error(err?.message ?? "Erro no StoreKit")));
      });

    offer.order().catch((err: any) => {
      done(() => reject(new Error(err?.message ?? "Falha ao iniciar compra")));
    });
  });
}
