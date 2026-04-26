import { tefillinPack } from "./tefillin-pack";
import { shacharisPack } from "./shacharis-pack";
import { shemaMorningPack } from "./shema-morning-pack";
import { minchaPack } from "./mincha-pack";
import { maarivPack } from "./maariv-pack";
import { shemaNightPack } from "./shema-night-pack";
import { kotelChallengePack } from "./kotel-challenge-pack";
import { omerPack } from "./omer-pack";
import { dafYomiPack } from "./daf-yomi-pack";
import { chanukahPack } from "./chanukah-pack";
import { elulSelichotPack } from "./elul-selichot-pack";
import type { StarterPack } from "./types";

export { type StarterPack };

export const STARTER_PACKS: StarterPack[] = [
  tefillinPack,
  shacharisPack,
  shemaMorningPack,
  minchaPack,
  maarivPack,
  shemaNightPack,
  kotelChallengePack,
  omerPack,
  dafYomiPack,
  chanukahPack,
  elulSelichotPack,
];
