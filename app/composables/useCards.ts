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

    return data as CardCollections[];
  };

  return {
    getCardCollections,
  };
};
