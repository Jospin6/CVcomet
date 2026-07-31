// redux/user/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store'; // Assure-toi que tu as bien configuré le store
import axios from 'axios';
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
}

// Initial state
const initialState: UserState = {
  user: null,
  currentUser: null,
  users: [],
  status: 'idle',
  error: null,
  templateUpdated: false,
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

export const fetchcurrentUser = createAsyncThunk(
  "user/currentUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/me", { withCredentials: true });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue(error.response?.data || "Erreur inconnue");
      }
      return rejectWithValue("Erreur inconnue");
    }
  }
);

export const updateCurrentTemplate = createAsyncThunk("user/updateCurrentTemplate", async ({ id, type, currentTemplateId }: { id: string, type: string, currentTemplateId: string }, { rejectWithValue }) => {
  let url = ""
  if (type === "CV") {
    url = `/api/users/${id}/updateTemplate`
  } else {
    url = `/api/users/${id}/updateCoverLetter`
  }
  try {
    const response = await axios.put(url, { id, currentTemplateId });
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
      .addCase(fetchcurrentUser.pending, state => {
        state.status = 'loading';
      })
      .addCase(fetchcurrentUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.currentUser = action.payload
      })
      .addCase(fetchcurrentUser.rejected, (state) => {
        state.status = 'failed';
        state.error = "An error occured"
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
