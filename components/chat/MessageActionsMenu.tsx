import { ReactionMenu } from "@/components/ReactionMenu";
import type { Message } from "@/types/chat";

export interface MessageActionsTarget {
  messageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MessageActionsMenuProps {
  target: MessageActionsTarget;
  message: Message | undefined;
  currentUserId: string;
  canModifyMessage: (message: Message) => boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  onReply: (message: Message) => void;
  onCopy: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}

export function MessageActionsMenu({
  target,
  message,
  currentUserId,
  canModifyMessage,
  onEmojiSelect,
  onClose,
  onReply,
  onCopy,
  onEdit,
  onDelete,
}: MessageActionsMenuProps) {
  const isOwn = message != null && message.senderId === currentUserId;
  const canModify = message != null && canModifyMessage(message);
  const isText = message?.type === "text";
  const isDeleted = message?.isDeleted === true;
  const closeAndRun = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <ReactionMenu
      visible
      targetX={target.x}
      targetY={target.y}
      targetWidth={target.width}
      targetHeight={target.height}
      onEmojiSelect={onEmojiSelect}
      onClose={onClose}
      onReply={
        message && !isDeleted
          ? closeAndRun(() => onReply(message))
          : undefined
      }
      onCopy={
        message && isText && !isDeleted
          ? closeAndRun(() => onCopy(message))
          : undefined
      }
      onEdit={
        message && isOwn && isText && canModify
          ? closeAndRun(() => onEdit(message))
          : undefined
      }
      onDelete={
        message && isOwn && canModify
          ? closeAndRun(() => onDelete(message))
          : undefined
      }
    />
  );
}
