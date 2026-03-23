<template>
  <section class="carousel-wrap">
    <div class="carousel-container" @wheel.prevent="handleScroll">
      <article
        v-for="(handCard, index) in handCards"
        :key="String(handCard.id)"
        class="card"
        :class="{ selected: isSelected(handCard) }"
        :style="getCardStyle(index)"
        @click="emitSelect(handCard)"
      >
        <p>{{ getCardText(handCard.card_id) }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
type HandCard = {
  id: string | number;
  card_id: string;
};

type CollectionCard = {
  id: string;
  text: string;
};

const props = defineProps<{
  handCards: HandCard[];
  collectionCards: CollectionCard[];
  selectedCardIds?: Array<string | number>;
}>();

const emit = defineEmits<{
  (event: "select-card", card: HandCard): void;
}>();

const current = ref(0);
const scrollLockMs = 120;
let lastScrollAt = 0;

const maxIndex = computed(() => Math.max(0, props.handCards.length - 1));

const cardTextById = computed(() => {
  const map = new Map<string, string>();
  for (const card of props.collectionCards) {
    map.set(card.id, card.text);
  }
  return map;
});

const getCardText = (cardId: string) =>
  cardTextById.value.get(cardId) ?? "Loading...";

const isSelected = (card: HandCard) =>
  !!props.selectedCardIds?.some((id) => String(id) === String(card.id));

const emitSelect = (card: HandCard) => emit("select-card", card);

const getCardStyle = (index: number) => {
  const offsetFromCenter = index - current.value;

  // Feste Rotation für jede Karte (ändert sich nicht beim Scrollen)
  const fixedRotationDeg = (index - Math.floor(maxIndex.value / 2)) * 10;

  // Z-index ändert sich beim Scrollen - welche Karte ist zu oberst sichtbar
  const zIndex =
    offsetFromCenter === 0 ? 1000 : 100 - Math.abs(offsetFromCenter);

  const pivotX = 50; /* + (fixedRotationDeg / 45) * 50 */

  const spacing = 30;
  const translateX = offsetFromCenter * spacing;

  return {
    zIndex: String(zIndex),
    transform: `rotateZ(${fixedRotationDeg}deg) translateX(${translateX}px)`,
    transformOrigin: `${pivotX}% 100%`,
  };
};

const handleScroll = (event: WheelEvent) => {
  const now = Date.now();
  if (now - lastScrollAt < scrollLockMs) return;

  const delta = event.deltaY > 0 ? 1 : -1;

  if (
    (delta === -1 && current.value <= 0) ||
    (delta === 1 && current.value >= maxIndex.value)
  ) {
    return;
  }

  current.value = Math.max(0, Math.min(current.value + delta, maxIndex.value));
  lastScrollAt = now;
};

onMounted(() => {
  current.value = Math.floor(maxIndex.value / 2);
});
</script>
<style scoped>
.carousel-wrap {
  width: 100%;
  height: 30rem;
  padding: 2rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-container {
  position: relative;
  width: 13rem;
  height: 16rem;
}

.card {
  position: absolute;
  top: 0;
  left: 0;
  width: 13rem;
  height: 16rem;
  flex-shrink: 0;
  border-radius: 0.5rem;
  padding: 1.5rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 300ms ease,
    border-color 200ms ease,
    transform 300ms ease;
  transform-origin: center center;
}

.card:hover {
  opacity: 0.9;
}

.card.selected {
  border-color: #60a5fa;
  background: #eff6ff;
  box-shadow:
    0 0 0 2px #bfdbfe,
    0 12px 30px rgba(15, 23, 42, 0.16);
}

.card p {
  margin: 0;
  color: #1f2937;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}
</style>
