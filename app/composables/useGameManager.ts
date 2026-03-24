import type { Tables } from "../../types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const useGameManager = () => {
  const supabase = useSupabaseClient();
  if (!supabase) {
    console.error("Supabase client not initialized");
  }

  const isStartingNextRound = ref(false);



  // ACTION - Start next round (Czar)
  async function handleNextRound(roomId: string, gameChannel: Ref<RealtimeChannel>) {
    if (!isCzar.value) return;
    if (isStartingNextRound.value) return;
    isStartingNextRound.value = true;

    try {
      const { data, error } = await supabase.functions.invoke(
        "initialize_next_round",
        {
          method: "POST",
          body: {
            room_id: roomId,
          },
        },
      );

      if (error) {
        throw new Error(`Error initializing next round: ${error.message}`);
      } else {
        console.log("[EDGE] success initialize_next_round", data);
        gameChannel.value.send({
          type: "broadcast",
          event: "cards_dealt",
        });
      }
    } catch(error) {
        
    } finally {
      isStartingNextRound.value = false;
    }
  };

  return {
    handleNextRound,
  };
};
