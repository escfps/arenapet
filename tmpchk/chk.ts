import { SPECIES } from "../src/lib/game-data";
import { MOVESETS } from "../src/lib/movesets.generated";
const bad: string[] = [];
for (const [id, sp] of Object.entries(SPECIES)) {
  if ((sp as any).retired) continue;
  const ms: any = (MOVESETS as any)[id];
  const a = [sp.element, sp.secondaryElement].filter(Boolean).join("/");
  const b = ms ? ms.types.join("/") : "MISSING";
  if (a !== b) bad.push(`${id}: game=${a} moveset=${b}`);
}
console.log(bad.length, "mismatch"); console.log(bad.join("\n"));
