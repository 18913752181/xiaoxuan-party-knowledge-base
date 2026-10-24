import type { Profile } from "@/lib/types";

/** Display only; download authorization is always checked by the database. */
export function hasLegacyMaterialBenefits(profile: Profile | null | undefined, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(profile?.legacy_material_benefits && profile.member_status === "member"
    && profile.member_expires_at && profile.member_expires_at >= today);
}
