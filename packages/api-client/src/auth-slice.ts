import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResult, AuthUser } from '@marketbd/shared';

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  /** 'idle' until the app tried to restore a session on start-up. */
  status: 'idle' | 'restoring' | 'authenticated' | 'anonymous';
}

const initialState: AuthState = { user: null, accessToken: null, status: 'idle' };

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<AuthResult>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.tokens.accessToken;
      state.status = 'authenticated';
    },
    userUpdated(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
    restoring(state) {
      state.status = 'restoring';
    },
    signedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
    },
  },
});

export const { sessionStarted, userUpdated, restoring, signedOut } = authSlice.actions;

export interface RootStateWithAuth {
  auth: AuthState;
}

export const selectAuth = (s: RootStateWithAuth) => s.auth;
export const selectUser = (s: RootStateWithAuth) => s.auth.user;
export const selectIsAuthenticated = (s: RootStateWithAuth) => s.auth.status === 'authenticated';
