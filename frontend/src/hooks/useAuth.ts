import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

export function useAuth() {
  const { user, isAuthenticated, token } = useSelector(
    (state: RootState) => state.auth
  );

  return {
    user,
    isAuthenticated,
    token,
    isAdmin: user?.role === "ADMIN",
  };
}

