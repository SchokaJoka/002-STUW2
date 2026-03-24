export function usePlayerScores() {
  const supabase = useSupabaseClient();
  
  const playerScores = useState<Record<string, number>>("playerScores", () => ({}));

  function getPlayerScore(userId: string) {
    return playerScores.value[userId] ?? 0;
  };

  async function updatePlayerScoreFromMember(updatedMember: any) {
    if (!updatedMember?.user_id) return;

    const nextPoints = Number(updatedMember.points ?? 0);
    playerScores.value[updatedMember.user_id] = Number.isFinite(nextPoints)
      ? nextPoints
      : 0;
  };

  async function syncPlayerScoresForRoom(roomId: string) {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("room_members")
      .select("user_id, points")
      .eq("room_id", roomId);

    if (error) {
      console.error("Error syncing player points:", error);
      return;
    }

    const nextScores: Record<string, number> = {};

    (data ?? []).forEach((member: any) => {
      if (!member?.user_id) return;
      const nextPoints = Number(member.points ?? 0);
      nextScores[member.user_id] = Number.isFinite(nextPoints) ? nextPoints : 0;
    });

    playerScores.value = nextScores;
  };

  return {
    playerScores,
    getPlayerScore,
    updatePlayerScoreFromMember,
    syncPlayerScoresForRoom,
  };
}
