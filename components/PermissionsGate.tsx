import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

export function PermissionsGate() {
  const { sessionReady } = useAuth();

  usePermissions(sessionReady);

  return null;
}
