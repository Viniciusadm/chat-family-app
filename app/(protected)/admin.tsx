import { AddUserModal } from "@/components/admin/AddUserModal";
import { ChatFormModal } from "@/components/admin/ChatFormModal";
import { ChatsSection } from "@/components/admin/ChatsSection";
import { DeleteChatModal } from "@/components/admin/DeleteChatModal";
import { DeleteChildModal } from "@/components/admin/DeleteChildModal";
import { errorMessage } from "@/components/admin/errorMessage";
import { MembersSection } from "@/components/admin/MembersSection";
import { PendingDevicesSection } from "@/components/admin/PendingDevicesSection";
import { SecuritySection } from "@/components/admin/SecuritySection";
import { AppHeader } from "@/components/AppHeader";
import { LoadingDots } from "@/components/LoadingDots";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/context/AuthContext";
import { useAdminData } from "@/hooks/useAdminData";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { spacing, type ThemeTokens } from "@/theme/tokens";
import type { AppMember, Chat } from "@/types/chat";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingGap: {
      height: spacing.lg,
    },
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.huge,
      gap: spacing.sm,
    },
  });

export default function AdminScreen() {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    members,
    sessionUserNames,
    pendingDevices,
    chats,
    loading,
    canMutate,
    addUser,
    approveDevice,
    rejectDevice,
    createChat,
    updateChat,
    updateChatPhoto,
    removeChatPhoto,
    deleteChat,
    deleteChildMember,
  } = useAdminData();

  const [showAddUser, setShowAddUser] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    session: number;
    name: string;
    participants: string[];
  }>({ session: 0, name: "", participants: [] });
  const [deviceActionId, setDeviceActionId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [childToDelete, setChildToDelete] = useState<AppMember | null>(null);

  useEffect(() => {
    if (canMutate) return;
    setShowAddUser(false);
    setShowCreateChat(false);
    setEditingChatId(null);
    setChatToDelete(null);
    setChildToDelete(null);
  }, [canMutate]);

  if (currentUser?.role !== "adult") {
    return <Redirect href="/" />;
  }

  const confirmLogout = () => {
    Alert.alert("Sair", "Deseja sair da sua conta neste aparelho?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          void logout().catch(() => {});
        },
      },
    ]);
  };

  const handleApproveDevice = async (deviceId: string) => {
    if (deviceActionId) return;
    setDeviceActionId(deviceId);
    try {
      await approveDevice(deviceId);
    } catch (e) {
      Alert.alert(
        "Erro ao aprovar",
        errorMessage(e, "Não foi possível aprovar o dispositivo.")
      );
    } finally {
      setDeviceActionId(null);
    }
  };

  const handleRejectDevice = async (deviceId: string) => {
    if (deviceActionId) return;
    setDeviceActionId(deviceId);
    try {
      await rejectDevice(deviceId);
    } catch (e) {
      Alert.alert(
        "Erro ao recusar",
        errorMessage(e, "Não foi possível recusar o dispositivo.")
      );
    } finally {
      setDeviceActionId(null);
    }
  };

  const openEditChat = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditForm((prev) => ({
      session: prev.session + 1,
      name: chat.name,
      participants: chat.participants,
    }));
  };

  return (
    <ScreenContainer style={styles.screen} edges={["bottom"]}>
      <AppHeader
        title="Gerenciamento"
        onBack={() => router.back()}
        rightIcon="log-out-outline"
        onRightPress={confirmLogout}
        rightAccessibilityLabel="Sair"
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <View style={styles.loadingGap} />
          <LoadingDots />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <MembersSection
            members={members}
            canMutate={canMutate}
            onAddUser={() => setShowAddUser(true)}
            onDeleteChild={setChildToDelete}
          />
          <PendingDevicesSection
            pendingDevices={pendingDevices}
            sessionUserNames={sessionUserNames}
            canMutate={canMutate}
            deviceActionId={deviceActionId}
            onApprove={(deviceId) => void handleApproveDevice(deviceId)}
            onReject={(deviceId) => void handleRejectDevice(deviceId)}
          />
          <ChatsSection
            chats={chats}
            members={members}
            currentUserId={currentUser.id}
            canMutate={canMutate}
            onCreateChat={() => setShowCreateChat(true)}
            onEditChat={openEditChat}
            onDeleteChat={setChatToDelete}
          />
          <SecuritySection onOpenEncryption={() => router.push("/encryption")} />
        </ScrollView>
      )}

      <AddUserModal
        visible={canMutate && showAddUser}
        onClose={() => setShowAddUser(false)}
        addUser={addUser}
      />

      <ChatFormModal
        mode="create"
        visible={canMutate && showCreateChat}
        members={members}
        onSubmit={createChat}
        onClose={() => setShowCreateChat(false)}
      />

      <ChatFormModal
        key={editForm.session}
        mode="edit"
        visible={canMutate && editingChatId !== null}
        members={members}
        initialName={editForm.name}
        initialParticipants={editForm.participants}
        photoChat={chats.find((c) => c.id === editingChatId)}
        onSubmit={async (name, participantIds) => {
          if (!editingChatId) return;
          await updateChat(editingChatId, name, participantIds);
        }}
        onClose={() => setEditingChatId(null)}
        onUpdatePhoto={async (localUri) => {
          if (!editingChatId) return;
          await updateChatPhoto(editingChatId, localUri);
        }}
        onRemovePhoto={async () => {
          if (!editingChatId) return;
          await removeChatPhoto(editingChatId);
        }}
      />

      <DeleteChatModal
        visible={canMutate && chatToDelete !== null}
        chat={chatToDelete}
        onClose={() => setChatToDelete(null)}
        deleteChat={deleteChat}
      />

      <DeleteChildModal
        visible={canMutate && childToDelete !== null}
        child={childToDelete}
        onClose={() => setChildToDelete(null)}
        deleteChildMember={deleteChildMember}
      />
    </ScreenContainer>
  );
}
