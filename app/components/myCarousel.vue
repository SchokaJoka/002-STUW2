<template>
  <section
    class="carousel-wrap"
    @wheel.capture.prevent="handleWheel"
    :style="carouselOffsetStyle"
  >
    <Carousel
      v-model="current"
      :items-to-show="visibleCards"
      :items-to-scroll="1"
      :wrap-around="false"
      snap-align="center"
      :mouse-drag="false"
      :touch-drag="true"
      class="hand-carousel"
    >
      <Slide
        v-for="(handCard, index) in handCards"
        :key="String(handCard.id)"
        :style="getFanStyle(index)"
      >
        <article
          class="card"
          :class="{ selected: isSelected(handCard) }"
          @click="emitSelect(handCard)"
        >
          <p>{{ getCardText(handCard.card_id) }}</p>
        </article>
      </Slide>
    </Carousel>
  </section>
</template>

<script setup lang="ts">
import { Carousel, Slide } from "vue3-carousel";
import "vue3-carousel/dist/carousel.css";

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

const visibleCards = 3;
const current = ref(4);

const scrollLockMs = 120;
let lastScrollAt = 0;

const maxIndex = computed(() => Math.max(0, props.handCards.length - 1));

const atStart = computed(() => current.value <= 0);
const atEnd = computed(() => current.value >= maxIndex.value);

const clampIndex = (value: number) =>
  Math.min(Math.max(value, 0), maxIndex.value);

const step = (direction: 1 | -1) => {
  current.value = clampIndex(current.value + direction);
};

const getFanStyle = (index: number) => {
  const offsetFromCenter = index - current.value;
  const stepDeg = 4; // angle distance between cards
  const radiusX = 40; // horizontal radius in px
  const radiusY = 500; // vertical radius in px

  const angleDeg = offsetFromCenter * stepDeg;
  const angleRad = (angleDeg * Math.PI) / 180;

  const x = Math.sin(angleRad) * radiusX;
  const y = (1 - Math.cos(angleRad)) * radiusY;

  return {
    "--cx": x + "px",
    "--cy": y + "px",
    "--cr": angleDeg + "deg",
    zIndex: String(100 - Math.abs(offsetFromCenter)),
  };
};

const handleWheel = (event: WheelEvent) => {
  const now = Date.now();
  if (now - lastScrollAt < scrollLockMs) return;

  const delta =
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

  if (Math.abs(delta) < 8) return;

  const direction: 1 | -1 = delta > 0 ? 1 : -1;

  // Normal finite scrolling in range.
  if (
    (direction === -1 && !atStart.value) ||
    (direction === 1 && !atEnd.value)
  ) {
    step(direction);
  } else {
    // End reached: allow sticky pull and bounce-back.
    applyOverscroll(direction);
  }
};

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
</script>

<style scoped>
.carousel-wrap {
  width: min(960px, 100%);
  margin-inline: auto;
  padding: 1rem;
  transition: transform 220ms cubic-bezier(0.22, 1.2, 0.36, 1);
  will-change: transform;
}

.hand-carousel {
  --vc-nav-background: #0f172a;
  --vc-nav-color: #ffffff;
}
:deep(.carousel__viewport) {
  overflow: visible;
  /* padding-block: 1.25rem; */
  /* padding-inline: 0.75rem; */
}

.card {
  width: 13rem;
  height: 16rem;
  max-width: 13rem;
  min-height: 16rem;
  margin-inline: auto;
  border-radius: 0.5rem;
  padding: 1.5rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
  cursor: pointer;
  /* transform-origin: 50% 130%; */
  transform: translate(var(--cx, 0px), var(--cy, 0px))
    rotate(calc(var(--cr, 0deg)));
  transition:
    transform 240ms ease,
    border-color 240ms ease,
    background-color 240ms ease;
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

:deep(.carousel__slide) {
  overflow: visible;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  opacity: 1;
  transform: none;
  transition: opacity 240ms ease;
}

:deep(.carousel__track) {
  align-items: center;
  min-height: 20rem;
}
</style>
