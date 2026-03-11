<script setup>
import { useAppSupabaseClient } from '~/utils/supabase'

const supabase = useAppSupabaseClient()

const route = useRoute()
const roomCode = String(route.params.roomId ?? '').toUpperCase()

// Game state
const players = ref([])
const gameState = ref(null)
const authError = ref('')
const currentPlayerId = ref(null)
const currentRoomDbId = ref(null)
const isLeaving = ref(false)
const gameStarted = ref(false)
const currentCzarIndex = ref(null)

// First player in join order acts as game master.
const currentGameMasterUserId = computed(() => {
    const firstPlayer = players.value[0]
    return firstPlayer?.user_id ?? null
})

// True when this client is the current game master.
const isCurrentPlayerGameMaster = computed(() => {
    return !!currentPlayerId.value && currentPlayerId.value === currentGameMasterUserId.value
})

// User id of the active czar for the current round.
const currentCzarUserId = computed(() => {
    if (!gameStarted.value || currentCzarIndex.value === null) {
        return null
    }

    const currentPlayer = players.value[currentCzarIndex.value]
    return currentPlayer?.user_id ?? null
})

// True when this client is the active czar.
const isCurrentPlayerCzar = computed(() => {
    return !!currentPlayerId.value && currentPlayerId.value === currentCzarUserId.value
})

let gameChannel


// ACTION - Start game
const startGame = async () => {
    if (!gameChannel || players.value.length === 0 || !isCurrentPlayerGameMaster.value) {
        console.log('Cannot start game: No channel, no players, or current player is not game master')
        return
    }

    await gameChannel.send({
        type: 'broadcast',
        event: 'game_control',
        payload: {
            action: 'start',
            czarIndex: 0
        }
    })
}

// ACTION - Move to next czar/round
const goToNextCzar = async () => {
    if (!gameChannel || !gameStarted.value || players.value.length === 0 || !isCurrentPlayerCzar.value) {
        return
    }

    const previousIndex = currentCzarIndex.value ?? -1
    const nextIndex = (previousIndex + 1) % players.value.length

    await gameChannel.send({
        type: 'broadcast',
        event: 'game_control',
        payload: {
            action: 'next',
            czarIndex: nextIndex
        }
    })
}

const markMemberInactive = async () => {
    return 
}

const leaveRoom = async () => {
    await navigateTo('/')
}

const handlePageHide = () => {

}

onBeforeRouteLeave(() => {
    

})

onMounted(async () => {
    authError.value = ''
    window.addEventListener('pagehide', handlePageHide)

    const { data: currentAuthData } = await supabase.auth.getUser()
    let currentUser = currentAuthData.user

    if (!currentUser) {
        const { data: anonymousAuthData, error: anonymousAuthError } = await supabase.auth.signInAnonymously()

        if (anonymousAuthError) {
            authError.value = 'Could not create guest session. Please refresh and try again.'
            console.error('Anonymous auth failed:', anonymousAuthError)
            return
        }

        currentUser = anonymousAuthData.user
    }



    if (!currentUser?.id) {
        authError.value = 'No player identity available. Please refresh and try again.'
        return
    }

    console.log('Signed in anonymously as guest user:', currentUser)


    const playerId = currentUser.id
    const playerType = currentUser.is_anonymous ? 'guest' : 'user'
    const joinedAt = Date.now()

    currentPlayerId.value = playerId

    // CREATE or JOIN a channel
    gameChannel = supabase.channel(`${roomCode}`, {
        config: {
            broadcast: {
                self: true
            },
            presence: {
                key: playerId
            }
        }
    })

    console.log("Created game channel:", gameChannel)

    // 2. Listen for Presence (Who is in the room?)
    gameChannel.on('presence', { event: 'sync' }, () => {
        const newState = gameChannel.presenceState()
        
        players.value = Object.keys(newState)
            .map(key => newState[key][0])
            .sort((a, b) => {
                const firstJoinedAt = Number(a.joined_at ?? 0)
                const secondJoinedAt = Number(b.joined_at ?? 0)

                if (firstJoinedAt !== secondJoinedAt) {
                    return firstJoinedAt - secondJoinedAt
                }

                return a.user_id.localeCompare(b.user_id)
            })

        if (players.value.length === 0) {
            gameStarted.value = false
            currentCzarIndex.value = null
        }
        else if (gameStarted.value && (currentCzarIndex.value === null || currentCzarIndex.value >= players.value.length)) {
            currentCzarIndex.value = 0
        }
    })

    // 3. Listen for Broadcasts (Quick actions, e.g., drawing a card)
    gameChannel.on('broadcast', { event: 'card_played' }, (payload) => {
        console.log('Opponent played a card!', payload)
        // Update local UI
    })

    // Listen for game control events (start, next round, etc.)
    gameChannel.on('broadcast', { event: 'game_control' }, (payload) => {
        const action = payload?.payload?.action
        const czarIndex = payload?.payload?.czarIndex

        if (typeof czarIndex !== 'number') {
            return
        }

        if (action === 'start') {
            gameStarted.value = true
            currentCzarIndex.value = czarIndex
            return
        }

        if (action === 'next') {
            gameStarted.value = true
            currentCzarIndex.value = czarIndex
        }
    })

    // 5. Subscribe to the channel
    gameChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            // Track authenticated users and guests in Presence
            await gameChannel.track({
                user_id: playerId,
                player_type: playerType,
                status: 'playing',
                joined_at: joinedAt
            })
        }
    })
})

onUnmounted(() => {
    window.removeEventListener('pagehide', handlePageHide)
    void markMemberInactive()

    // Clean up the WebSocket connection when the user leaves the page
    if (gameChannel) {
        supabase.removeChannel(gameChannel)
    }
})
</script>

<template>
    <div class="mx-auto max-w-2xl p-4 sm:p-6">
        <div class="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <h1 class="text-xl font-semibold">Game Room</h1>
            <p class="mt-1 text-sm text-gray-600">Room Code: {{ roomCode }}</p>

            <div class="mt-5">
                <h2 class="text-sm font-medium text-gray-700">Players in this room</h2>

                <ul class="mt-2 space-y-2">
                    <li v-for="player in players" :key="player.user_id"
                        class="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                        <span class="font-medium text-gray-900">
                            {{ player.user_id }}
                            <span v-if="currentPlayerId === player.user_id" class="ml-2 text-xs font-semibold text-emerald-700">
                                (You)
                            </span>
                            <span v-if="currentGameMasterUserId === player.user_id" class="ml-2 text-xs font-semibold text-amber-700">
                                (Game Master)
                            </span>
                        </span>
                        <span class="text-gray-600">
                            {{ player.status }}
                            <span v-if="gameStarted && currentCzarUserId === player.user_id" class="ml-2 font-semibold text-indigo-600">
                                CZAR
                            </span>
                        </span>
                    </li>
                </ul>

                <p v-if="players.length === 0" class="mt-2 text-sm text-gray-500">
                    Waiting for players to join...
                </p>

                <p v-if="authError" class="mt-2 text-sm text-red-600">
                    {{ authError }}
                </p>

                <button @click="leaveRoom"
                    class="mt-4 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    Leave Room
                </button>

                <div class="mt-3 flex gap-2">
                    <button @click="startGame" :disabled="players.length === 0 || !isCurrentPlayerGameMaster"
                        class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                        Start Game
                    </button>

                    <button @click="goToNextCzar" :disabled="!gameStarted || players.length === 0 || !isCurrentPlayerCzar"
                        class="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60">
                        Next
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Game UI goes here -->
</template>

<script>
    // ==================================================================
    // ROOM DATABASE CHECK
    // ==================================================================
    /*
    const { data: existingRoom, error: roomLookupError } = await supabase
      .from('rooms')
      .select('id,code')
      .eq('code', roomCode)
      .maybeSingle()
  
    if (roomLookupError) {
      authError.value = 'Could not verify room. Please refresh and try again.'
      console.error('Room lookup failed:', roomLookupError)
      return
    }
  
    if (!existingRoom) {
      authError.value = 'Room does not exist.'
      return
    }
  
    const roomDbId = existingRoom.id
    currentPlayerId.value = playerId
    currentRoomDbId.value = roomDbId
    isLeaving.value = false
  
    const { error: memberUpsertError } = await supabase
      .from('room_members')
      .upsert(
        {
          room_id: roomDbId,
          user_id: playerId,
          role: 'player',
          is_active: true,
          left_at: null
        },
        {
          onConflict: 'room_id,user_id'
        }
      )
  
    if (memberUpsertError) {
      authError.value = 'Could not save room membership. Please refresh and try again.'
      console.error('Room member upsert failed:', memberUpsertError)
      return
    }
    */

    /*
    // 4. Listen for Database Changes (Authoritative game state)
    // Make sure you enable Realtime for the 'game_moves' table in Supabase dashboard
    gameChannel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_moves', filter: `room_id=eq.${roomDbId}` },
        (payload) => {
            console.log('New move recorded in DB:', payload.new)
            // Process the move
        }
    )
        
    */

    /*

    if (!currentPlayerId.value || !currentRoomDbId.value || isLeaving.value) {
        return
    }

    isLeaving.value = true

    const { data, error } = await supabase
        .from('room_members')
        .update({
            is_active: false,
            left_at: new Date().toISOString()
        })
        .eq('room_id', currentRoomDbId.value)
        .eq('user_id', currentPlayerId.value)

    if (error) {
        console.error('Failed to mark member inactive:', error)
    }
    else {
        console.log('Marked member as inactive successfully', data)
    }

    */
</script>