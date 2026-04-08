<script setup lang="ts">
import type { RealtimeChannel } from "@supabase/supabase-js";

// VARIABLES
// ============================================================
const user = useSupabaseUser();
const supabase = useSupabaseClient();

const route = useRoute();
const roomId = ref<string>("");
const playerId = ref<string>("");
const roomCode = ref<string>("");

const players = useState<any[]>("players", () => []);
const gameChannel = useState<RealtimeChannel | null>("gameChannel", () => null);
const isGameMaster = useState<boolean>("isGameMaster", () => false);

const myChosenWhiteCards = useState<string[]>("myChosenWhiteCards", () => []);
const selectedPlayerSubmission = ref<any | null>(null);
const isWhiteCardsSubmitted = useState<boolean>("isWhiteCardsSubmitted", () => false);
const isSubmittingWhiteCards = ref<boolean>(false);
const isChoosingWinner = ref<boolean>(false);

const gameStarted = useState<boolean>("gameStarted", () => false);

const GAP_TOKEN: string = "[[W1tnYXBdXQ==]]";

type TextPart = {
    text: string;
    isGap: boolean;
    gapIndex?: number;
};

// ============================================================

// COMPOSABLES
// ============================================================
const { headerEl } = useHeaderHeight();
const {
    // Variables
    isLeaving,
    gameMasterId,

    // Functions
    getRoomIdByCode,
    getRoomMetadata,
    enterRoom,
    deletePlayerFromRoomTable,
    markMemberInactive,
    trackMyStatus,
    leaveRoomRealtime,
} = useRoom();

const {
    // Variables
    isStartingNextRound,
    gameState,
    roundStatus,
    blackCard,
    playerSubmissions,
    winnerUserId,
    winnerUsername,
    winnerCards,
    gameManagerRoomId,
    gameManagerPlayerId,

    // Functions
    initializeNextRound,
    handleGameStateChanges,
} = useGameManager();

const { syncPlayerScoresForRoom } = usePlayerScores();
// ============================================================

const draftText = ref<string>("");
const blackCardDraftError = ref<string>("");
const draftTextarea = ref<HTMLTextAreaElement | null>(null);


// COMPUTED PROPERTIES
// ============================================================
const czarId = computed(() => {
    if (!gameStarted.value) return null;
    return gameState.value?.czar_id ?? null;
});

const isCzar = computed(() => {
    return !!playerId.value && playerId.value === czarId.value;
});

const createEditorVisible = computed(() => isCzar.value && roundStatus.value === "round_start" && !blackCard.value);

watch(createEditorVisible, async (visible) => {
    if (visible) {
        await nextTick();
        await focusContent();
    }
});



const numberOfCardsToPlay = computed(() => {
    const card = blackCard.value as any;
    if (!card || card.number_of_gaps == null) return 1;
    if (card.number_of_gaps === 0) return 1;
    return card.number_of_gaps;
});

const getTextParts = (text: string): TextPart[] => {
    if (!text.includes(GAP_TOKEN)) {
        return [{ text, isGap: false }];
    }

    const textParts = text.split(GAP_TOKEN);
    const parts: TextPart[] = [];
    let gapIndex = 0;

    textParts.forEach((part: string, index: number) => {
        parts.push({ text: part, isGap: false });

        if (index < textParts.length - 1) {
            parts.push({ text: "", isGap: true, gapIndex });
            gapIndex += 1;
        }
    });

    return parts;
};

const blackCardTextParts = computed(() => {
    const text = blackCard.value?.text || "";
    return getTextParts(text);
});

watch([playerId, gameMasterId], ([nextPlayerId, nextGameMasterId]) => {
    isGameMaster.value = !!nextPlayerId && nextGameMasterId === nextPlayerId;
});

const myPresenceStatus = computed(() => {
    if (!gameStarted.value || roundStatus.value === "lobby") {
        return "waiting";
    }

    if (roundStatus.value === "round_start") {
        if (isCzar.value) return "czar";
        return isWhiteCardsSubmitted.value ? "submitted" : "choosing";
    }

    if (roundStatus.value === "round_submitted") {
        return isCzar.value ? "judging" : "waiting";
    }

    if (roundStatus.value === "round_end") {
        if (winnerUserId.value && winnerUserId.value === playerId.value)
            return "winner";
        return "round end";
    }

    return "playing";
});

watch(myPresenceStatus, async () => {
    await trackMyStatus(myPresenceStatus.value, roomId.value);
});

watch(
    numberOfCardsToPlay,
    (count) => {
        const nextCount = Number(count ?? 1);
        const next: string[] = [];
        for (let i = 0; i < nextCount; i += 1) {
            next.push(myChosenWhiteCards.value[i] ?? "");
        }
        myChosenWhiteCards.value = next;
    },
    { immediate: true },
);

const judgingCarouselItems = computed(() => {
    return playerSubmissions.value.flatMap((submission: any) => {
        const texts = (submission.metadata?.submitted_cards ?? []) as string[];
        return texts.map((text, index) => ({
            id: `${submission.user_id}-${index}`,
            card_id: `creative-${submission.user_id}-${index}`,
            submission,
            text,
        }));
    });
});

const judgingLookupCards = computed(() => {
    return judgingCarouselItems.value.map((item) => ({
        id: item.card_id,
        text: item.text,
    }));
});

const selectedJudgingCardIds = computed(() => {
    if (!selectedPlayerSubmission.value?.user_id) return [];
    const selectedId = String(selectedPlayerSubmission.value.user_id);
    return judgingCarouselItems.value
        .filter((item) => String(item.submission.user_id) === selectedId)
        .map((item) => item.id);
});
// ============================================================

// Single-text draft editor for the black card (minimal, caret-aware)
const insertGap = async () => {
    const el = contentEl.value as HTMLElement | null;
    if (!el) return;
    // create gap span
    const span = document.createElement('span');
    span.setAttribute('data-gap', '1');
    span.setAttribute('contenteditable', 'false');
    span.className = 'inline-block m-1 p-2 bg-white text-black rounded-md';
    span.innerText = '____';

    // add delete button inside span
    const btn = document.createElement('button');
    btn.className = 'ml-1 -mt-2 w-6 h-6 rounded-full bg-white flex items-center justify-center';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M19.9999 6C20.2547 6.00028 20.4999 6.09788 20.6852 6.27285C20.8706 6.44782 20.9821 6.68695 20.997 6.94139C21.012 7.19584 20.9292 7.44638 20.7656 7.64183C20.602 7.83729 20.37 7.9629 20.1169 7.993L19.9999 8H19.9189L18.9999 19C18.9999 19.7652 18.7075 20.5015 18.1826 21.0583C17.6576 21.615 16.9398 21.9501 16.1759 21.995L15.9999 22H7.99987C6.40187 22 5.09587 20.751 5.00787 19.25L5.00287 19.083L4.07987 8H3.99987C3.74499 7.99972 3.49984 7.90212 3.3145 7.72715C3.12916 7.55218 3.01763 7.31305 3.0027 7.05861C2.98776 6.80416 3.07054 6.55362 3.23413 6.35817C3.39772 6.16271 3.62977 6.0371 3.88287 6.007L3.99987 6H19.9999ZM9.99987 10C9.73465 10 9.4803 10.1054 9.29276 10.2929C9.10523 10.4804 8.99987 10.7348 8.99987 11V17C8.99987 17.2652 9.10523 17.5196 9.29276 17.7071C9.4803 17.8946 9.73465 18 9.99987 18C10.2651 18 10.5194 17.8946 10.707 17.7071C10.8945 17.5196 10.9999 17.2652 10.9999 17V11C10.9999 10.7348 10.8945 10.4804 10.707 10.2929C10.5194 10.1054 10.2651 10 9.99987 10ZM13.9999 10C13.7347 10 13.4803 10.1054 13.2928 10.2929C13.1052 10.4804 12.9999 10.7348 12.9999 11V17C12.9999 17.2652 13.1052 17.5196 13.2928 17.7071C13.4803 17.8946 13.7347 18 13.9999 18C14.2651 18 14.5194 17.8946 14.707 17.7071C14.8945 17.5196 14.9999 17.2652 14.9999 17V11C14.9999 10.7348 14.8945 10.4804 14.707 10.2929C14.5194 10.1054 14.2651 10 13.9999 10ZM13.9999 2C14.5303 2 15.039 2.21071 15.4141 2.58579C15.7892 2.96086 15.9999 3.46957 15.9999 4C15.9996 4.25488 15.902 4.50003 15.727 4.68537C15.5521 4.8707 15.3129 4.98223 15.0585 4.99717C14.804 5.01211 14.5535 4.92933 14.358 4.76574C14.1626 4.60214 14.037 4.3701 14.0069 4.117L13.9999 4H9.99987L9.99287 4.117C9.96277 4.3701 9.83715 4.60214 9.6417 4.76574C9.44625 4.92933 9.19571 5.01211 8.94126 4.99717C8.68682 4.98223 8.44769 4.8707 8.27272 4.68537C8.09775 4.50003 8.00015 4.25488 7.99987 4C7.99971 3.49542 8.19028 3.00943 8.53337 2.63945C8.87646 2.26947 9.34671 2.04284 9.84987 2.005L9.99987 2H13.9999Z" fill="black"/>
                    </svg>`;
    btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        span.remove();
        syncDraftFromContent();
        focusContent();
    });
    span.appendChild(btn);

    // insert at caret
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
        el.appendChild(span);
    } else {
        const range = sel.getRangeAt(0);
        range.collapse(false);
        range.insertNode(span);
        // move caret after span
        range.setStartAfter(span);
        range.setEndAfter(span);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    syncDraftFromContent();
    await nextTick();
    focusContent();
};

const focusInput = async (index = 0) => {
    await nextTick();
    const el = draftTextarea.value;
    if (!el) return;
    el.focus();
    const pos = draftText.value.length;
    try {
        el.selectionStart = el.selectionEnd = pos;
    } catch (e) {
        // ignore if not supported
    }
};

const buildBlackCardText = () => draftText.value.replace(/___/g, GAP_TOKEN);

const blackCardGapCount = computed(() => (draftText.value.match(/___/g) || []).length);


const contentEl = ref<HTMLElement | null>(null);


const deleteDraftPart = async (index: number) => {
    // remove the gap element at the index within the contentEl
    const el = contentEl.value as HTMLElement | null;
    if (!el) return;
    const gaps = Array.from(el.querySelectorAll('[data-gap]'));
    const target = gaps[index] as HTMLElement | undefined;
    if (target) {
        target.remove();
        // synchronize draftText
        syncDraftFromContent();
        await nextTick();
        focusContent();
    }
};

const focusContent = async () => {
    await nextTick();
    const el = contentEl.value as HTMLElement | null;
    if (!el) return;
    el.focus();
};

const syncDraftFromContent = () => {
    const el = contentEl.value as HTMLElement | null;
    if (!el) return;
    const parts: string[] = [];
    el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.textContent || "");
        } else if ((node as HTMLElement).dataset && (node as HTMLElement).dataset.gap !== undefined) {
            parts.push("___");
        } else if (node instanceof HTMLElement) {
            parts.push(node.innerText || "");
        }
    });
    draftText.value = parts.join("");
};

const onContentInput = (e: Event) => {
    syncDraftFromContent();
};

const onContentKeyDown = (e: KeyboardEvent) => {
    // keep behavior minimal; allow default typing which updates content
};

async function submitBlackCard() {
    if (!isCzar.value || !roomId.value) return;

    const text = buildBlackCardText();
    if (!text.trim()) {
        blackCardDraftError.value = "Black card cannot be empty.";
        return;
    }

    blackCardDraftError.value = "";
    const cardPayload = {
        text,
        number_of_gaps: blackCardGapCount.value,
        is_black: true,
    };

    const { data, error } = await supabase.functions.invoke(
        "submit_black_card",
        {
            method: "POST",
            body: {
                room_id: roomId.value,
                czar_id: playerId.value,
                card: cardPayload,
            },
        },
    );

    if (error) {
        console.error("Error saving black card:", error);
        return;
    }

    console.log("[EDGE] success submit_black_card", data);

    blackCard.value = cardPayload;
}

const canSubmitWhiteCards = computed(() => {
    if (!blackCard.value) return false;
    return myChosenWhiteCards.value.every((text) => text.trim().length > 0);
});

async function submitCards() {
    if (isSubmittingWhiteCards.value) return;
    isSubmittingWhiteCards.value = true;

    try {
        const { data, error } = await supabase.functions.invoke(
            "submit_white_cards",
            {
                method: "POST",
                body: {
                    czar_id: czarId.value,
                    user_id: playerId.value,
                    room_id: roomId.value,
                    submitted_cards: myChosenWhiteCards.value.map((text) => text.trim()),
                },
            },
        );
        if (error) {
            console.error("[EDGE] Error submitting white cards:", error);
        } else {
            isWhiteCardsSubmitted.value = true;
            console.log("[EDGE] success submit_white_cards", data);
        }
    } finally {
        isSubmittingWhiteCards.value = false;
    }
}

// Czar Choose Winner Handling
// ============================================================
async function pickWinner(item: any) {
    if (!isCzar.value) return;
    selectedPlayerSubmission.value = item.submission;
}

async function submitWinner(winnerSubmission: any) {
    if (!isCzar.value) return;

    const { data, error } = await supabase.functions.invoke("select_winner", {
        method: "POST",
        body: {
            room_id: roomId.value,
            winner: winnerSubmission,
        },
    });

    if (error) {
        console.error("Error selecting winner:", error);
    } else {
        console.log("[EDGE] success select_winner", data);
    }
}

async function startNextRound() {
    if (!isCzar.value || !roomId.value) return;
    if (isStartingNextRound.value) return;

    await initializeNextRound(roomId.value);

    isWhiteCardsSubmitted.value = false;
    myChosenWhiteCards.value = [];
    draftText.value = "";
    selectedPlayerSubmission.value = null;
}

async function saveSet() {
    if (!isGameMaster.value || !roomId.value) return;

    const name = prompt("Set name");
    if (!name || !name.trim()) return;

    const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .select("metadata")
        .eq("id", roomId.value)
        .single();

    if (roomErr) {
        console.error("Error loading room metadata:", roomErr);
        return;
    }

    const playedBlack = (room?.metadata?.played_black_cards ?? []) as any[];
    const playedWhite = (room?.metadata?.played_white_cards ?? []) as string[];

    const { data: collection, error: collectionErr } = await supabase
        .from("collections")
        .insert({
            name: name.trim(),
            user_id: user.value?.id || user.value?.sub,
        })
        .select("id")
        .single();

    if (collectionErr || !collection?.id) {
        console.error("Error creating collection:", collectionErr);
        return;
    }

    const collectionId = collection.id;
    const cardsToInsert = [
        ...playedWhite.map((text) => ({
            text,
            is_black: false,
            collection_id: collectionId,
        })),
        ...playedBlack.map((card) => ({
            text: card.text,
            is_black: true,
            number_of_gaps: Number(card.number_of_gaps ?? 0),
            collection_id: collectionId,
        })),
    ];

    const { error: cardsErr } = await supabase.from("cards").insert(cardsToInsert);
    if (cardsErr) {
        console.error("Error saving cards:", cardsErr);
    }
}

// ============================================================
// onMounted, onUnmounted
// ============================================================
const isNavigatingWithinRoom = ref(false);

onMounted(async () => {
    roomCode.value = String(route.params.roomCode ?? "").toUpperCase();

    roomId.value = await getRoomIdByCode(roomCode.value);

    if (!roomId.value) {
        console.error("Missing room ID");
        return;
    }

    gameManagerRoomId.value = roomId.value;

    /*     const roomMetadata = await getRoomMetadata(roomId.value);
     */
    if (user.value) {
        playerId.value = user.value.sub;
    } else {
        navigateTo("/login?redirect=joinGame&roomCode=" + roomCode.value);
        return;
    }

    if (!playerId.value) {
        console.error("Missing player ID");
        return;
    }

    gameManagerPlayerId.value = playerId.value;

    const { data: room } = await supabase
        .from("rooms")
        .select("owner")
        .eq("id", roomId.value)
        .single();
    gameMasterId.value = room?.owner ?? null;

    await syncPlayerScoresForRoom(roomId.value);

    /*     if (!gameChannel.value) {
            enterRoom(roomId.value, roomCode.value, playerId.value, "waiting");
        }
    
        const metadata = (roomMetadata?.metadata ?? null) as any;
        if (metadata) {
            await handleGameStateChanges(metadata); */
    if (!gameChannel.value) {
        await enterRoom(roomId.value, roomCode.value, playerId.value, "waiting");
        console.log(playerId.value, roomId.value, roomCode.value);
        // Load existing room metadata/state so reloading the page restores current round
        try {
            const roomMetadata = await getRoomMetadata(roomId.value);
            const initialMetadata = (roomMetadata?.metadata ?? null) as any;
            if (initialMetadata) {
                // If a collection/set is present, game manager or broadcasts will populate cards; ensure scores synced
                await syncPlayerScoresForRoom(roomId.value);
                await handleGameStateChanges(initialMetadata);
            }
        } catch (e) {
            console.error("Error loading initial room metadata:", e);
        }
    }
}
);

onBeforeRouteLeave((to) => {
    if (to.params.roomCode === route.params.roomCode) {
        isNavigatingWithinRoom.value = true;
    }
});

onUnmounted(async () => {
    if (!isLeaving.value && roomId.value && playerId.value) {
        await markMemberInactive(roomId.value, playerId.value);
    }

    if (!isNavigatingWithinRoom.value) {
        await leaveRoomRealtime();
    }
});
// ============================================================

const roundStatusMessage = computed(() => {
    switch (roundStatus.value) {
        case "lobby":
            return "Waiting for players...";
        case "round_start":
            return isCzar.value
                ? blackCard.value
                    ? "Wait for players to submit..."
                    : "Create the black card!"
                : "Write your white card(s)!";
        case "round_submitted":
            return isCzar.value ? "Pick the winner!" : "Waiting for Czar...";
        case "round_end":
            return winnerUsername.value
                ? `${winnerUsername.value.toUpperCase()} won the round!`
                : "Round ended. Waiting for next round...";
        default:
            return "";
    }
});

const getWhiteCardTextAtGap = (gapIndex?: number) => {
    if (typeof gapIndex !== "number") return null;
    return myChosenWhiteCards.value[gapIndex] || null;
};
// ============================================================
</script>

<template>
    <main class="flex flex-col items-center w-full min-h-dvh">
        <!-- header -->
        <header ref="headerEl" class="fixed pt-[env(safe-area-inset-top),0px)] w-full flex flex-col p-4 gap-2 z-40">
            <div class="w-full flex flex-row items-stretch justify-between gap-2">
                <div class="flex flex-row w-full items-center justify-start overflow-x-auto gap-2">
                    <!-- player list -->
                    <div v-for="player in players" :key="player.user_id" class="flex flex-col items-center gap-1">
                        <div class="flex items-center justify-center size-12 rounded-full border-2 transition-all"
                            :class="czarId === player.user_id
                                ? 'border-yellow-300'
                                : player.status === 'submitted'
                                    ? 'border-green-300'
                                    : 'border-black'
                                ">
                            <img src="https://placehold.co/40" alt="Player avatar"
                                class="size-10 rounded-full object-cover" />
                        </div>
                        <span class="text-xs font-semibold transition">{{ player.user_id === playerId ? 'You' :
                            player.user_name
                            }}</span>
                    </div>
                </div>
                <!-- action leave -->
                <Button @click="deletePlayerFromRoomTable(roomId, playerId)" variant="primary" size="md"
                    class="rounded-xl">
                    Leave
                </Button>
            </div>
            <!-- round status message -->
            <div class="w-full flex flex-row gap-2">
                <div class="w-full text-center font-medium text-md">
                    {{ roundStatusMessage }}
                </div>
            </div>
        </header>

        <!-- game section -->
        <section name="game-section" v-if="gameStarted"
            class="w-full mt-[var(--sets-header-h)] h-[calc(100dvh-var(--sets-header-h))] flex items-center gap-4 overflow-y-visible py-4"
            :class="isCzar ? 'flex-col-reverse justify-start' : 'flex-col justify-start'">
            <TransitionGroup name="fade">

                <!-- black card -->
                <div v-if="blackCard" class="rounded-xl bg-black p-6 pb-12 text-lg font-bold text-white">
                    <div class="w-full max-w-[46.75dvw] min-w-[10.2rem] md:max-w-md" style="aspect-ratio: 56 / 72;">
                        <div class="w-full h-full p-2 break-words whitespace-normal overflow-hidden">
                            <span v-for="(part, index) in blackCardTextParts" :key="`black-card-${index}`"
                                :class="part.isGap ? 'inline-block m-1 p-2 bg-white text-black rounded-md break-words break-all' : 'break-words break-all'">
                                {{ part.isGap ? getWhiteCardTextAtGap(part.gapIndex) || "___" : part.text }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- create black card -->
                <div v-if="isCzar && roundStatus === 'round_start' && !blackCard"
                    class="w-64 h-80 rounded-xl bg-black p-4 text-lg font-bold flex flex-col items-start justify-between">

                    <!-- Text input Area -->
                    <div class="w-full pb-2 overflow-y-auto">
                        <div ref="contentEl" contenteditable @input="onContentInput" @keydown="onContentKeyDown"
                            :data-placeholder="'start writing...'" :class="{ 'content-empty': !draftText }"
                            class="w-full h-full text-white focus:outline-none break-words whitespace-pre-wrap max-h-full overflow-auto relative">
                        </div>
                    </div>

                    <!-- Buttons GAP Submit -->
                    <div class="w-full flex flex-row items-center justify-between">
                        <Button @click="insertGap" variant="primary" size="sm" class="rounded-lg h-10">Insert
                            Gap</Button>
                        <Button @click="submitBlackCard" variant="primary" size="sm"
                            class="rounded-lg h-10">Submit</Button>
                    </div>
                    <p v-if="blackCardDraftError" class="text-red-200 text-sm mt-2">{{ blackCardDraftError }}
                    </p>
                </div>

                <!-- white cards input -->
                <div v-if="!isCzar && roundStatus === 'round_start' && !isWhiteCardsSubmitted && blackCard"
                    class="w-full max-w-2xl flex flex-col gap-3">
                    <div v-for="(_, index) in numberOfCardsToPlay" :key="`white-input-${index}`" class="w-full">
                        <input v-model="myChosenWhiteCards[index]" type="text" placeholder="Write your white card..."
                            @focus="trackMyStatus('writing', roomId)" @blur="trackMyStatus(myPresenceStatus, roomId)"
                            class="w-full bg-white border-2 border-black rounded-lg px-4 py-3 text-lg" />
                    </div>
                </div>

                <!-- judging area -->
                <div v-if="roundStatus === 'round_submitted'" class="w-full h-full overflow-y-visible z-10">
                    <MyCarousel :items="judgingCarouselItems" :lookup-cards="judgingLookupCards"
                        :selected-ids="selectedJudgingCardIds" selected-class="selected-judging"
                        @select-item="pickWinner" />
                </div>

                <div v-if="roundStatus === 'round_end'" class="w-full p-4">
                    <div
                        class="flex flex-row items-center justify-start gap-4 bg-gray-100 p-4 rounded-lg transition-all">
                        <div v-for="(text, index) in winnerCards" :key="index"
                            class="relative w-full min-h-48 max-w-36 rounded-lg shadow-lg bg-white p-3 font-medium text-sm transition-all">
                            {{ text }}
                            <div class="absolute bottom-2 right-3 text-xs text-red-500">
                                {{ winnerUsername }}
                            </div>
                            <div class="absolute bottom-2 left-3 text-xs text-gray-400">
                                {{ index + 1 }}
                            </div>
                        </div>
                    </div>
                </div>
            </TransitionGroup>
        </section>

        <section name="action-buttons" v-if="gameStarted"
            class="fixed bottom-[max(env(safe-area-inset-bottom),1.5rem)] w-full flex flex-row items-center justify-center transition-all z-40">
            <transition name="fade" mode="out-in">
                <Button v-if="roundStatus === 'round_start' && !isCzar && !isWhiteCardsSubmitted" @click="submitCards"
                    :disabled="isSubmittingWhiteCards || !canSubmitWhiteCards" variant="primary" size="md"
                    class="rounded-xl" key="submit-cards">
                    {{ isSubmittingWhiteCards ? "Submitting..." : "Submit" }}
                </Button>
                <Button v-else-if="roundStatus === 'round_submitted' && isCzar"
                    @click="submitWinner(selectedPlayerSubmission)"
                    :disabled="isChoosingWinner || !selectedPlayerSubmission" variant="primary" size="md"
                    class="rounded-xl" key="choose-winner">
                    {{ isChoosingWinner ? "Choosing..." : "Choose" }}
                </Button>
                <Button v-else-if="roundStatus === 'round_end' && isCzar" @click="startNextRound"
                    :disabled="isStartingNextRound" variant="primary" size="md" class="rounded-xl" key="next-round">
                    {{ isStartingNextRound ? "Loading..." : "Next Round" }}
                </Button>
            </transition>
        </section>

        <section v-if="roundStatus === 'round_end' && isGameMaster"
            class="fixed bottom-[max(env(safe-area-inset-bottom),5rem)] w-full flex flex-row items-center justify-center z-40">
            <Button @click="saveSet" variant="tertiary" size="md" class="rounded-xl">Save Set</Button>
        </section>
    </main>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 300ms ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

:deep(.card.selected-judging) {
    @apply border-red-400 bg-red-50 ring-2 ring-red-200;
}

/* Contenteditable placeholder */
[contenteditable].content-empty::before {
    content: attr(data-placeholder);
    @apply text-white/50 cursor-text;
}

/* hide scrollbar utility */
.no-scrollbar::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

/* make textarea text invisible while keeping caret visible */
.transparent-text {
    color: transparent;
    caret-color: white;
}

.editor-area .preview {
    font-size: 1.125rem;
    /* match text-lg */
    line-height: 1.25rem;
}

.editor-area textarea {
    font-size: 1.125rem;
    line-height: 1.25rem;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: 0;
}

/* legacy gap-pill removed; using inline Tailwind classes to match final black-card look */

.preview>div {
    max-width: 100%;
    word-break: break-word;
}
</style>
