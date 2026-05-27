// StoreKit nativo (iOS) via @capgo/native-purchases. Em Android/Web cai em Paddle.
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { creditIapGems, activateIosBattlePass, IOS_BATTLE_PASS_PRODUCT } from "@/lib/iap.functions";

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

/**
 * Compra um pack via StoreKit no iOS usando o plugin nativo do Capacitor.
 * Retorna `{ credited: true, gems }` quando o servidor confirma o crédito.
 */
export async function purchaseIosGemsPack(packId: string): Promise<{ credited: boolean; gems: number }> {
  const productId = IOS_PRODUCT_IDS[packId];
  if (!productId) throw new Error("Pacote indisponível no iOS");

  let transactionId: string;
  try {
    const result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.INAPP,
      quantity: 1,
    });
    transactionId = String((result as any).transactionId ?? "");
    if (!transactionId) throw new Error("Transação sem ID");
  } catch (err: any) {
    // O usuário cancelar é um erro comum — propaga com mensagem clara
    const msg = err?.message ?? String(err);
    if (/cancel/i.test(msg)) throw new Error("Compra cancelada");
    throw new Error(msg || "Erro no StoreKit");
  }

  // Valida e credita no servidor (idempotente por transactionId)
  const res = await creditIapGems({
    data: {
      productId,
      transactionId,
      platform: "ios",
    },
  });

  // Finaliza a transação no StoreKit só depois do crédito confirmado
  try {
    await NativePurchases.acknowledgePurchase({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.INAPP,
    } as any);
  } catch {
    // não bloqueia: servidor já creditou, idempotência cobre re-tentativas
  }

  return { credited: true, gems: res.gems ?? 0 };
}

/**
 * Assina o Passe de Batalha via StoreKit (auto-renewable subscription).
 */
export async function purchaseIosBattlePass(): Promise<{ activated: boolean; vipUntil: string | null }> {
  const productId = IOS_BATTLE_PASS_PRODUCT;

  let transactionId: string;
  try {
    const result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
      quantity: 1,
    });
    transactionId = String((result as any).transactionId ?? "");
    if (!transactionId) throw new Error("Transação sem ID");
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (/cancel/i.test(msg)) throw new Error("Compra cancelada");
    throw new Error(msg || "Erro no StoreKit");
  }

  const res = await activateIosBattlePass({
    data: { productId, transactionId, platform: "ios" },
  });

  try {
    await NativePurchases.acknowledgePurchase({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
    } as any);
  } catch {
    // servidor já ativou; idempotência cobre re-tentativas
  }

  return { activated: true, vipUntil: res.vip_until ?? null };
}
