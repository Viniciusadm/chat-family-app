import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Device } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { createAdminCardStyles } from "./adminStyles";
import { SectionTitle } from "./SectionTitle";

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    deviceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    deviceInfo: {
      flex: 1,
    },
    emptyBox: {
      backgroundColor: t.muted,
      borderRadius: radius.md,
      padding: spacing.xxl,
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    emptyText: {
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
    },
  });

type PendingDevicesSectionProps = {
  pendingDevices: Device[];
  sessionUserNames: Record<string, string>;
  canMutate: boolean;
  deviceActionId: string | null;
  onApprove: (deviceId: string) => void;
  onReject: (deviceId: string) => void;
};

export function PendingDevicesSection({
  pendingDevices,
  sessionUserNames,
  canMutate,
  deviceActionId,
  onApprove,
  onReject,
}: PendingDevicesSectionProps) {
  const { theme } = useTheme();
  const cardStyles = useThemedStyles(createAdminCardStyles);
  const styles = useThemedStyles(createStyles);
  const busy = deviceActionId !== null;

  const confirmReject = (deviceId: string, ownerName?: string) => {
    if (deviceActionId) return;
    Alert.alert(
      "Recusar dispositivo?",
      ownerName
        ? `O dispositivo de ${ownerName} não poderá acessar as conversas.`
        : "Este dispositivo não poderá acessar as conversas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recusar",
          style: "destructive",
          onPress: () => onReject(deviceId),
        },
      ],
    );
  };

  return (
    <>
      <SectionTitle
        icon="phone-portrait-outline"
        label="Dispositivos pendentes"
      />
      {pendingDevices.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhum dispositivo pendente</Text>
        </View>
      ) : (
        pendingDevices.map((device) => {
          const ownerName = sessionUserNames[device.userId];
          return (
            <View key={device.id} style={cardStyles.card}>
              <View style={styles.deviceRow}>
                <View style={styles.deviceInfo}>
                  <Text style={cardStyles.cardTitle}>
                    {ownerName ?? "Dispositivo desconhecido"}
                  </Text>
                  <Text style={cardStyles.cardMeta}>
                    {device.id.slice(0, 8)}… · {formatTime(device.createdAt)}
                  </Text>
                </View>
                {canMutate ? (
                  <>
                    <Pressable
                      onPress={() => onApprove(device.id)}
                      disabled={busy}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Aprovar dispositivo de ${ownerName ?? "desconhecido"}`}
                      accessibilityState={{ disabled: busy }}
                      style={[cardStyles.iconAct, busy && cardStyles.btnDisabled]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={28}
                        color={theme.primary}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmReject(device.id, ownerName)}
                      disabled={busy}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Recusar dispositivo de ${ownerName ?? "desconhecido"}`}
                      accessibilityState={{ disabled: busy }}
                      style={[cardStyles.iconAct, busy && cardStyles.btnDisabled]}
                    >
                      <Ionicons
                        name="close-circle"
                        size={28}
                        color={theme.destructive}
                      />
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </>
  );
}
