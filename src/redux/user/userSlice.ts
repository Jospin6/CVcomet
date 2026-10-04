// redux/user/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store'; // Assure-toi que tu as bien configuré le store
import axios from 'axios';
import { login, signup } from '../auth/authSlice';
import { Project } from '../project/projectSlice';

type Certification = {
  id: string;
  name: string;
  organization: string;
  description: string;
  date: string;
};

type Education = {
  id: string;
  degree: string;
  school: string;
  location: string;
  start: string;
  end?: string;
  description: string;
};

type Experience = {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end?: string;
  description: string;
};

export interface User {
  headline?: string;
  careerGoal?: import("@/lib/career-profile/schema").ProfileData["careerGoal"];
  experienceLevel?: import("@/lib/career-profile/schema").ProfileData["experienceLevel"];
  targetJobTitle?: string;
  targetIndustry?: string;
  targetCountry?: string;
  preferredWorkMode?: import("@/lib/career-profile/schema").ProfileData["preferredWorkMode"];
  targetMarket?: import("@/lib/career-profile/schema").ProfileData["targetMarket"];
  referralSource?: import("@/lib/career-profile/schema").ProfileData["referralSource"];
  templateAccent?: string;
  coverLetterAccent?: string;
  onboardingCompletedAt?: string | null;
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  portfolio?: string;
  isSubscribed?: boolean;
  summary?: string;
  skills?: string;
  hobbies?: string;
  languages?: string;
  currentTemplateId?: string;
  currentCoverLetterId?: string;
  role?: "ADMIN" | "USER";
  github?: string;
  Education?: Education[];
  Project?: Project[]
  Experience?: Experience[];
  certifications?: Certification[];
  createdAt?: string;
  lastGeneratedAt?: string;
  generationCount?: number;
}

interface UserState {
  user: User | null;
  users: User[];
  currentUser: User | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  templateUpdated: boolean;
  sessionStatus: 'idle' | 'loading' | 'authenticated' | 'anonymous';
  sessionRequestId?: string;
}

// Initial state
const initialState: UserState = {
  user: null,
  currentUser: null,
  users: [],
  status: 'idle',
  error: null,
  templateUpdated: false,
  sessionStatus: 'idle',
};

export const deleteSubscription = createAsyncThunk<string, string>(
  'user/deleteSubscription',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/stripe/cancel-subscription`, { userId });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue(error.response?.data || "Erreur inconnue");
      }
      return rejectWithValue("Erreur inconnue");
    }
  }
);
// Thunks pour appeler l'API
export const fetchUser = createAsyncThunk<User, string>(
  'user/fetchUser',
  async (userId: string) => {
    const response = await axios.get(`/api/users/${userId}`);
    return response.data;
  }
);

// Thunks pour appeler l'API
export const fetchUsers = createAsyncThunk<User[]>(
  'user/fetchUsers',
  async () => {
    const response = await axios.get(`/api/users`);
    return response.data;
  }
);

export const addUser = createAsyncThunk('user/addUser', async (newUser: User) => {
  const response = await axios.post('/api/users', newUser);
  return response.data;
})

export const updateUser = createAsyncThunk(
  'user/updateUser',
  async ({ id, data }: { id: string; data: User }) => {
    const response = await axios.put(`/api/users/${id}`, data);
    return response.data;
  }
);

export const fetchcurrentUser = createAsyncThunk<User, void, { state: RootState }>(
  "user/currentUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<User>("/api/me", { withCredentials: true });
      return response.data;
    } catch { return rejectWithValue("Session unavailable"); }
  },
  { condition: (_, {getState}) => getState().user.sessionStatus === "idle" }
);

export const updateCurrentTemplate = createAsyncThunk("user/updateCurrentTemplate", async ({ id, type, currentTemplateId, accent }: { id: string, type: string, currentTemplateId: string, accent?: string }, { rejectWithValue }) => {
  let url = ""
  if (type === "CV") {
    url = `/api/users/${id}/updateTemplate`
  } else {
    url = `/api/users/${id}/updateCoverLetter`
  }
  try {
    const response = await axios.put(url, { id, currentTemplateId, accent });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return rejectWithValue(error.response?.data || "Erreur inconnue");
    }
    return rejectWithValue("Erreur inconnue");
  }
})

// User slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    resetTemplateUpdated: (state) => {
      state.templateUpdated = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchcurrentUser.pending, (state, action) => {
        state.sessionStatus = "loading";
        state.sessionRequestId = action.meta.requestId;
      })
      .addCase(fetchcurrentUser.fulfilled, (state, action) => {
        if (state.sessionRequestId !== action.meta.requestId) return;
        state.sessionStatus = "authenticated";
        state.sessionRequestId = undefined;
        state.currentUser = action.payload;
      })
      .addCase(fetchcurrentUser.rejected, (state, action) => {
        if (state.sessionRequestId !== action.meta.requestId) return;
        state.sessionStatus = "anonymous";
        state.sessionRequestId = undefined;
        state.currentUser = null;
        state.user = null;
      })

      .addCase(fetchUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.status = 'succeeded';
        state.user = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch user data';
      })
      .addCase(updateUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.status = 'succeeded';
        state.user = action.payload;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to update user data';
      })
      .addCase(updateCurrentTemplate.fulfilled, (state) => {
        state.templateUpdated = true;
      });

    builder.addCase(login.fulfilled, (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload; state.user = action.payload;
      state.sessionStatus = "authenticated"; state.sessionRequestId = undefined;
    }).addCase(signup.fulfilled, (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload; state.user = action.payload;
      state.sessionStatus = "authenticated"; state.sessionRequestId = undefined;
    }).addCase("auth/logout/fulfilled", () => ({ ...initialState, sessionStatus: "anonymous" }));

    builder.addCase(fetchUsers.pending, (state) => {
      state.status = 'loading';
    })
      .addCase(fetchUsers.fulfilled, (state, action: PayloadAction<User[]>) => {
        state.status = 'succeeded';
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch user data';
      })
  },
});

// Selectors
export const selectUser = (state: RootState) => state.user.user;
export const selectUsers = (state: RootState) => state.user.users;
export const selectUserStatus = (state: RootState) => state.user.status;
export const selectUserError = (state: RootState) => state.user.error;
export const selectCurrentUser = (state: RootState) => state.user.currentUser
export const selectUpdateCurrentTeplated = (state: RootState) => state.user.templateUpdated

export const { resetTemplateUpdated } = userSlice.actions;
export default userSlice.reducer;
