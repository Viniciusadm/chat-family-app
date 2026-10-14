import * as Haptics from "expo-haptics";

export function lightImpact() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function selectionFeedback() {
  void Haptics.selectionAsync().catch(() => {});
}
