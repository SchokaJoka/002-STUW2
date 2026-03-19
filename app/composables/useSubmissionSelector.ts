import { computed, ref, shallowRef, type Ref } from "vue";

type Key = string | number;

type RequiredCountInput =
  | number
  | Ref<number | null | undefined>
  | (() => number | null | undefined);

type SubmitHandler<T> = (selectedItems: T[]) => Promise<unknown> | unknown;

type UseSubmissionSelectorOptions<T> = {
  getKey?: (item: T) => Key;
  requiredCount?: RequiredCountInput;
  initialSelected?: T[];
  deselectOnRepeatPick?: boolean;
};

function resolveRequiredCount(input?: RequiredCountInput): number {
  if (typeof input === "number") {
    return Math.max(1, input);
  }

  if (typeof input === "function") {
    const value = input();
    return Math.max(1, Number(value ?? 1));
  }

  if (input && typeof input === "object" && "value" in input) {
    return Math.max(1, Number(input.value ?? 1));
  }

  return 1;
}

export const useSubmissionSelector = <T>(
  options: UseSubmissionSelectorOptions<T> = {},
) => {
  const selectedItems = shallowRef<T[]>(options.initialSelected ?? []);
  const errorMessage = ref("");
  const isSubmitting = ref(false);
  const deselectOnRepeatPick = options.deselectOnRepeatPick ?? true;

  const requiredCount = computed(() =>
    resolveRequiredCount(options.requiredCount),
  );

  const getKey = (item: T): Key => {
    if (options.getKey) return options.getKey(item);

    const maybeObject = item as unknown as Record<string, unknown>;
    const id = maybeObject?.id;
    if (typeof id === "string" || typeof id === "number") return id;

    return JSON.stringify(item);
  };

  const clearError = () => {
    errorMessage.value = "";
  };

  const resetSelection = () => {
    selectedItems.value = [];
    clearError();
  };

  const isSelected = (item: T) => {
    const key = getKey(item);
    return selectedItems.value.some((i) => getKey(i) === key);
  };

  // Picking a new item while at limit replaces the oldest one (same behavior as white card selection).
  const pick = (item: T) => {
    clearError();

    const key = getKey(item);
    const idx = selectedItems.value.findIndex((i) => getKey(i) === key);

    if (idx !== -1) {
      if (!deselectOnRepeatPick) return;
      selectedItems.value = selectedItems.value.filter((_, i) => i !== idx);
      return;
    }

    if (selectedItems.value.length === requiredCount.value) {
      selectedItems.value = [...selectedItems.value.slice(1), item];
      return;
    }

    selectedItems.value = [...selectedItems.value, item];
  };

  const validateSelection = () => {
    const required = requiredCount.value;

    if (selectedItems.value.length !== required) {
      errorMessage.value = "you have to pick " + required + " cards";
      return false;
    }

    clearError();
    return true;
  };

  const submitSelection = async (handler: SubmitHandler<T>) => {
    if (!validateSelection()) return false;
    if (isSubmitting.value) return false;

    isSubmitting.value = true;
    try {
      await handler([...selectedItems.value]);
      return true;
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    selectedItems,
    errorMessage,
    isSubmitting,
    requiredCount,
    pick,
    isSelected,
    validateSelection,
    submitSelection,
    resetSelection,
    clearError,
  };
};
