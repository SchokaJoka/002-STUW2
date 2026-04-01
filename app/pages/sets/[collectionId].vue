<template>
    <main class="w-full flex items-center justify-center bg-neutral-300">
        <header ref="headerEl" class="fixed top-0 w-full flex flex-col items-start justify-start z-10">
            <div class="flex flex-row items-center w-full gap-4 p-4 bg-white">
                <div class="hover:cursor-pointer" @click="navigateTo('/sets')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="33" viewBox="0 0 38 33" fill="none">
                        <path
                            d="M37 31.8505C32.596 26.4042 28.6852 23.314 25.2676 22.5797C21.85 21.8454 18.5962 21.7345 15.5062 22.2469V32L1 16.0852L15.5062 1.00003V10.2699C21.22 10.3155 26.0776 12.3922 30.079 16.5C34.0798 20.6078 36.3868 25.7247 37 31.8505Z"
                            stroke="black" stroke-width="2" stroke-linejoin="round" />
                    </svg>
                </div>
                <input v-model="collection.name" ref="collectionNameInputRef" type="text" placeholder="new Card-Set" @keyup.enter="($event.target as HTMLInputElement | null)?.blur()" @blur="saveCollectionName(collectionId, collection.name)"
                    class="p-2 w-full text-black text-4xl font-bold"></input>
                <div class="flex py-2 hover:cursor-pointer" @click="focusInput()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <g clip-path="url(#clip0_271_923)">
                            <path d="M6 24H0V18M21 9L15 3L18 0L24 6M9 21L3 15L12 6L18 12" fill="black" />
                        </g>
                        <defs>
                            <clipPath id="clip0_271_923">
                                <rect width="24" height="24" fill="white" />
                            </clipPath>
                        </defs>
                    </svg>
                </div>
            </div>
            <div class="w-full flex flex-row justify-center bg-white z-10">
                <div class="w-full flex flex-row bg-white z-10 max-w-3xl">
                    <button
                        class="w-full p-3 py-4 flex flex-row justify-center items-center gap-2 text-xl font-semibold rounded-t-lg transition-all duration-300 ease-out"
                        :class="activeTab === 'page1'
                            ? 'text-black bg-neutral-300'
                            : 'text-white bg-neutral-200 hover:bg-neutral-250'" @click="activeTab = 'page1'">
                        <span class="flex size-8 items-center justify-center bg-white rounded-full text-black">
                            {{ whiteCards.length }}
                        </span>
                        <span>
                            White Cards
                        </span>
                    </button>
                    <button
                        class="w-full px-3 py-4 flex flex-row justify-center items-center gap-2 text-xl font-semibold rounded-t-lg transition-all duration-300 ease-out"
                        :class="activeTab === 'page2'
                            ? 'text-black bg-neutral-300'
                            : 'text-white bg-neutral-200 hover:bg-neutral-250'" @click="activeTab = 'page2'">
                        <span class="flex size-8 items-center justify-center bg-black rounded-full text-white">
                            {{ blackCards.length }}
                        </span>
                        <span>
                            Black Cards
                        </span>
                    </button>
                </div>
            </div>
        </header>

        <section class="relative flex flex-col items-center justify-start w-full h-fit max-w-3xl">
            <div class="flex flex-col h-full w-full mt-[var(--sets-header-h)]">

                <div class="h-fit flex flex-col p-4 min-h-screen">
                    <div v-if="isLoading" class="flex flex-col gap-4 animate-pulse">
                        <div v-for="n in placeholderRows" :key="n"
                            class="w-full flex items-center gap-4 bg-neutral-100 p-5 rounded-lg border border-[3px] border-black/20">
                            <div class="h-9 w-9 rounded bg-neutral-200" />
                            <div class="h-6 w-1/3 rounded bg-neutral-200" />
                            <div class="ml-auto h-6 w-6 rounded bg-neutral-200" />
                        </div>
                    </div>

                    <Transition v-else name="tab-fade" mode="out-in">
                        <div :key="activeTab">
                            <div v-if="activeTab === 'page1'">
                                <div class="flex flex-col gap-4">
                                    <EditorWhiteCard v-for="whiteCard in whiteCards" :key="whiteCard.id"
                                        :card="whiteCard"
                                        :editor-id="getWhiteEditorId(whiteCard.id)"
                                        :can-edit="!activeEditorId || activeEditorId === getWhiteEditorId(whiteCard.id)"
                                        @update="(text) => saveUpdate(whiteCard.id, { text, updated_at: new Date().toISOString() })"
                                        @edit-start="handleEditStart"
                                        @edit-end="handleEditEnd"
                                        @delete="deleteCard(whiteCard.id, false)" />
                                </div>
                            </div>
                            <div v-else>
                                <div class="flex flex-col gap-4">
                                    <EditorBlackCard v-for="blackCard in blackCards" :key="blackCard.id"
                                        :card="blackCard"
                                        :editor-id="getBlackEditorId(blackCard.id)"
                                        :can-edit="!activeEditorId || activeEditorId === getBlackEditorId(blackCard.id)"
                                        @update="(data) => saveUpdate(blackCard.id, { text: data.text, number_of_gaps: data.number_of_gaps, updated_at: new Date().toISOString() })"
                                        @edit-start="handleEditStart"
                                        @edit-end="handleEditEnd"
                                        @delete="deleteCard(blackCard.id, true)" />
                                </div>
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
import EditorWhiteCard from "~/components/EditorWhiteCard.vue";
import type { Tables } from "../../../types/database.types";
import EditorBlackCard from "~/components/EditorBlackCard.vue";

type Cards = Tables<"cards">;
type Collections = Tables<"collections">;

const collectionNameInputRef = ref<HTMLInputElement | null>(null);

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const collectionId = useRoute().params.collectionId as string;

const collection = ref<Collections>({} as Collections);
const whiteCards = ref<Cards[]>([]);
const blackCards = ref<Cards[]>([]);
const isLoading = ref(true);
const placeholderRows = [1, 2, 3];
const activeEditorId = ref<string | null>(null);

const isUpdating = ref(false);

const activeTab = ref("page1");
const { headerEl, updateHeaderHeight } = useHeaderHeight("--sets-header-h");

const focusInput = () => {
    collectionNameInputRef.value?.focus();
};

function getWhiteEditorId(cardId: string) {
    return `white-${cardId}`;
}

function getBlackEditorId(cardId: string) {
    return `black-${cardId}`;
}

function handleEditStart(editorId: string) {
    activeEditorId.value = editorId;
}

function handleEditEnd(editorId: string) {
    if (activeEditorId.value === editorId) {
        activeEditorId.value = null;
    }
}

async function saveCollectionName(collectionId: string, name: string) {
    const trimmedName = name.trim();
    if (trimmedName === "") {
        alert("Collection name cannot be empty.");
        return;
    }

    const { error } = await supabase
        .from("collections")
        .update({ name: trimmedName, updated_at: new Date().toISOString() })
        .eq("id", collectionId);

    if (error) {
        console.error("Error updating collection name:", error);
        alert("Failed to update collection name.");
    } else {
        collection.value.name = trimmedName;
    }
}

async function saveUpdate(cardId: string, updates: any) {
    if (isUpdating.value) return;
    isUpdating.value = true;

    const { error } = await supabase
        .from("cards")
        .update(updates)
        .eq("id", cardId);

    if (error) {
        console.error("Error updating card:", error);
        alert("Failed to update card.");
    } else {
        // Update local state
        const whiteIdx = whiteCards.value.findIndex(c => c.id === cardId);
        if (whiteIdx !== -1) {
            whiteCards.value[whiteIdx] = { ...whiteCards.value[whiteIdx], ...updates };
        } else {
            const blackIdx = blackCards.value.findIndex(c => c.id === cardId);
            if (blackIdx !== -1) {
                blackCards.value[blackIdx] = { ...blackCards.value[blackIdx], ...updates };
            }
        }
    }
    isUpdating.value = false;
    return;
}

async function deleteCard(cardId: string, isBlack: boolean) {
    if (!confirm("Are you sure you want to delete this card? This action cannot be undone.")) return;

    const { error } = await supabase
        .from("cards")
        .delete()
        .eq("id", cardId);

    if (error) {
        console.error("Error deleting card:", error);
        alert("Failed to delete card.");
    } else {
        if (isBlack) {
            const editorId = getBlackEditorId(cardId);
            if (activeEditorId.value === editorId) {
                activeEditorId.value = null;
            }
            blackCards.value = blackCards.value.filter(c => c.id !== cardId);
        } else {
            const editorId = getWhiteEditorId(cardId);
            if (activeEditorId.value === editorId) {
                activeEditorId.value = null;
            }
            whiteCards.value = whiteCards.value.filter(c => c.id !== cardId);
        }
    }

    return;
}

onMounted(async () => {
    console.log("Current user:", user.value);
    const userId = user.value?.id ?? user.value?.sub;

    const collectionPromise = supabase
        .from("collections")
        .select("*")
        .eq("id", collectionId)
        .single();

    const whiteCardPromise = supabase
        .from("cards")
        .select("*")
        .eq("collection_id", collectionId)
        .eq("is_black", false);

    const blackCardPromise = supabase
        .from("cards")
        .select("*")
        .eq("collection_id", collectionId)
        .eq("is_black", true);

    try {
        const [collectionResult, whiteCardResult, blackCardResult] = await Promise.all([

            collectionPromise,
            whiteCardPromise,
            blackCardPromise,
        ]);

        if (collectionResult.error) {
            console.error("Error fetching user collections:", collectionResult.error);
        } else {
            collection.value = (collectionResult.data ?? {}) as Collections;
        }

        if (whiteCardResult.error) {
            console.error("Error fetching user collections:", whiteCardResult.error);
        } else {
            whiteCards.value = (whiteCardResult.data ?? []) as Cards[];
        }

        if (blackCardResult.error) {
            console.error("Error fetching public collections:", blackCardResult.error);
        } else {
            blackCards.value = (blackCardResult.data ?? []) as Cards[];
        }

        console.log("Fetched collection: ", collection.value);
        console.log("Fetched whiteCards: ", whiteCards.value);
        console.log("Fetched blackCards: ", blackCards.value);
    } finally {
        isLoading.value = false;
    }
});
</script>
