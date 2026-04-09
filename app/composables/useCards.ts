import type { Tables } from "../../types/database.types";

export type CardCollections = Tables<"collections">;
export type Cards = Tables<"cards">;

export const useCards = () => {
  const supabase = useSupabaseClient();

  if (!supabase) {
    console.error("Supabase client not initialized");
  }

  // Fetch all card setsx
  const getCardCollections = async () => {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching card sets:", error);
      return [];
    }

    // Ensure preferred ordering: first "Cards Against Humanity", then "Kampf gegen das Bünzlitum", then the rest by updated_at
    try {
      const preferred1 = "Cards Against Humanity";
      const preferred2 = "Kampf gegen das Bünzlitum";

      const items = (data as CardCollections[]) || [];

      const pickAndRemove = (arr: CardCollections[], name: string) => {
        const idx = arr.findIndex(
          (c) => (c.name || "").trim().toLowerCase() === name.toLowerCase(),
        );
        if (idx === -1) return null;
        return arr.splice(idx, 1)[0];
      };

      const remaining = [...items];
      const first = pickAndRemove(remaining, preferred1) ?? null;
      const second = pickAndRemove(remaining, preferred2) ?? null;

      const ordered: CardCollections[] = [];
      if (first) ordered.push(first);
      if (second) ordered.push(second);
      ordered.push(...remaining);

      return ordered;
    } catch (e) {
      console.warn("Error reordering collections, returning raw data", e);
      return data as CardCollections[];
    }
  };

  return {
    getCardCollections,
  };
};
