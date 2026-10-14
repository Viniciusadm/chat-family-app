import {
  fontSizes,
  fontWeights,
  lineHeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { StyleSheet } from "react-native";

export const createAdminCardStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      padding: spacing.lg,
      marginBottom: spacing.sm,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    cardMeta: {
      marginTop: spacing.xs,
      fontSize: fontSizes.footnote,
      color: t.mutedForeground,
    },
    outlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    outlineBtnText: {
      fontSize: fontSizes.bodySmall,
      color: t.foreground,
    },
    iconAct: {
      padding: spacing.sm,
    },
    pressed: {
      opacity: 0.85,
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });

export const createAdminModalStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.modalBackdrop,
    },
    modalCard: {
      backgroundColor: t.card,
      borderRadius: radius.lg,
      padding: spacing.xl,
      maxHeight: "85%",
    },
    modalTall: {
      maxHeight: "80%",
    },
    modalTitle: {
      fontSize: fontSizes.headline,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      marginBottom: spacing.lg,
    },
    input: {
      borderWidth: 1,
      borderColor: t.inputBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSizes.body,
      color: t.foreground,
      marginBottom: spacing.md,
    },
    fieldLabel: {
      fontSize: fontSizes.subhead,
      fontWeight: fontWeights.medium,
      color: t.mutedForeground,
      marginBottom: spacing.sm,
    },
    error: {
      fontSize: fontSizes.subhead,
      color: t.destructive,
      marginBottom: spacing.sm,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    modalGhost: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    modalPrimary: {
      backgroundColor: t.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    modalPrimaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    modalDanger: {
      backgroundColor: t.destructive,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    ghostText: {
      fontSize: fontSizes.body,
      color: t.mutedForeground,
    },
    primaryText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.primaryForeground,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    checkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    checkLabel: {
      fontSize: fontSizes.bodySmall,
      color: t.foreground,
    },
    deleteDesc: {
      fontSize: fontSizes.subhead,
      lineHeight: lineHeights.bodySmall,
      color: t.mutedForeground,
      marginBottom: spacing.sm,
    },
  });
