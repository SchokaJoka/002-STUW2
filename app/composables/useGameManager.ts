import type { RealtimeChannel } from "@supabase/supabase-js";

export function useGameManager() {
  const supabase = useSupabaseClient();

  const players = useState<any[]>("players", () => []);
  const gameChannel = useState<RealtimeChannel | null>(
    "gameChannel",
    () => null,
  );
  const isGameMaster = useState<boolean>("isGameMaster", () => false);

  const isStartingGame = ref(false);
  const isStartingNextRound = ref(false);

  let errorMessage = ref<string | null>(null);

  const { getCardCollections } = useCards();

  // async function setGameMasterIfNotExists(
  //   roomId: string,
  // ): Promise<string | null> {
  //   const { data } = await supabase
  //     .from("rooms")
  //     .select("owner")
  //     .eq("id", roomId)
  //     .single();

  //   console.log(`[GameMaster] Read owner from DB: ${data?.owner}`);
  //   return data?.owner ?? null;
  // }

  async function getGameMasterId(roomId: string): Promise<string | null> {
    const { data } = await supabase
      .from("rooms")
      .select("owner")
      .eq("id", roomId)
      .single();

    return data?.owner ?? null;
  }

  async function initializeGame(
    roomId: string,
    roomCode: string,
    dev2gaps: boolean,
  ) {
    console.log("[GameManager] initializeGame called with:", {
      roomId,
      roomCode,
      dev2gaps,
    });

    if (!gameChannel.value || players.value.length < 2 || !isGameMaster.value) {
      console.log("[GameManager] gameChannel:", gameChannel.value);
      console.log("[GameManager] players:", players.value);
      console.log("[GameManager] isGameMaster:", isGameMaster.value);
      if (players.value.length < 2)
        //display error message on html page that at least 2 players are required
        errorMessage.value =
          "At least 2 players are required to start the game.";
      return;
    }

    if (isStartingGame.value) return;
    isStartingGame.value = true;

    gameChannel.value.send({
      type: "broadcast",
      event: "navigate_to_game",
      payload: { roomCode },
    });

    try {
      // Fetch available card sets and pick the first one
      const sets = await getCardCollections();
      if (!sets || sets.length === 0) {
        console.error("No card sets available.");
        errorMessage.value = "No card sets available to start the game.";
        return;
      }

      const chosenSet = sets[0];
      if (!chosenSet) {
        console.error("Failed to pick a card set.");
        errorMessage.value = "Failed to pick a card set.";
        return;
      }

      gameChannel.value.send({
        type: "broadcast",
        event: "game_initialize",
        payload: { set_id: chosenSet.id }, // For now we just hardcode a set, but you could add a UI to select one
      });

      gameChannel.value.send({
        type: "broadcast",
        event: "game_start",
      });

      console.log("[GameManager] Initializing game with set:", chosenSet.name);

      const { data: edgeInitializeData } = await supabase.functions.invoke(
        "initialize_game",
        {
          method: "POST",
          body: {
            set_id: chosenSet.id,
            room_id: roomId,
            cardsPerPlayer: 8,
            dev2gaps: dev2gaps,
          },
        },
      );

      if (!edgeInitializeData) {
        console.error("Failed to assign hand cards.");
        return;
      }

      console.log("GameManager] Sending navigate_to_game broadcast");
      console.log("[GameManager] gameChannel:", !!gameChannel.value);

      gameChannel.value.send({
        type: "broadcast",
        event: "cards_dealt",
        payload: { roomId },
      });
    } finally {
      isStartingGame.value = false;
    }
  }

  // ACTION - Start next round (Czar)
  async function initializeNextRound(roomId: string | null) {
    if (!roomId || !gameChannel.value) return;
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
          payload: { roomId },
        });
      }
    } catch (e) {
      console.error("Error starting next round:", e);
    } finally {
      isStartingNextRound.value = false;
    }
  }

  return {
    // Variables
    isStartingGame,
    isStartingNextRound,
    errorMessage,
    gameChannel,

    // Functions
    initializeGame,
    initializeNextRound,
    getGameMasterId,
    // setGameMasterIfNotExists,
  };
}
