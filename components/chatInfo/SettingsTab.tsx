import { formatBytes } from "@/lib/chatStorage";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { spacing, type ThemeTokens } from "@/theme/tokens";
import { StyleSheet, View } from "react-native";
import { InfoRow } from "./InfoRow";

interface SettingsTabProps {
  isGroup: boolean;
  storageBytes: number | null;
  exporting: boolean;
  onExport: () => void;
  onClear: () => void;
  onDeleteGroup?: () => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
      marginVertical: spacing.sm,
    },
  });

export function SettingsTab({
  isGroup,
  storageBytes,
  exporting,
  onExport,
  onClear,
  onDeleteGroup,
}: SettingsTabProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View>
      <InfoRow
        icon="folder-open-outline"
        title="Armazenamento"
        subtitle={
          storageBytes === null
            ? "Calculando…"
            : `Fotos e áudios neste aparelho · ${formatBytes(storageBytes)}`
        }
      />
      <View style={styles.divider} />
      <InfoRow
        icon="lock-closed-outline"
        title="Criptografia"
        subtitle="As mensagens são protegidas com criptografia de ponta a ponta. Só quem participa da conversa consegue ler."
      />
      <View style={styles.divider} />
      <InfoRow
        icon="share-outline"
        title={exporting ? "Exportando…" : "Exportar conversa"}
        subtitle="Gera um arquivo de texto com as mensagens"
        onPress={exporting ? undefined : onExport}
      />
      <InfoRow
        icon="remove-circle-outline"
        title="Limpar conversa"
        subtitle="Apaga as mensagens só deste aparelho"
        destructive
        onPress={onClear}
      />
      {isGroup && onDeleteGroup ? (
        <>
          <View style={styles.divider} />
          <InfoRow
            icon="trash-outline"
            title="Apagar grupo"
            subtitle="Remove o grupo e as mensagens para todos"
            destructive
            onPress={onDeleteGroup}
          />
        </>
      ) : null}
    </View>
  );
}
